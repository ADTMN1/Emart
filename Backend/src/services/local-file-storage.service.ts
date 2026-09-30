import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import {
  STORAGE_NAMESPACE,
  StorageNamespace,
  dirModeFor,
  fileModeFor,
  namespaceDir,
  resolveStoragePath,
  storageConfig,
} from '../config/storage';

/**
 * Thin, dependency-free filesystem layer that backs every storage service.
 *
 * Responsibilities kept here (and nowhere else):
 *  - creating the namespace directories with the right ownership modes
 *  - resolving a relative storage path to a contained absolute path
 *  - atomic writes (temp file in the destination directory + rename), so a
 *    crashed or concurrent request can never leave a half-written image that a
 *    public URL already points at
 *  - uniform error semantics (`remove` is idempotent, `read` streams do not
 *    leak ENOENT as a raw errno)
 */

export class StorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

export interface StoredFileStats {
  size: number;
  /** Epoch milliseconds of the last modification. */
  modifiedAt: number;
}

const ALL_NAMESPACES: StorageNamespace[] = [
  STORAGE_NAMESPACE.products,
  STORAGE_NAMESPACE.shopMedia,
  STORAGE_NAMESPACE.sellerDocuments,
];

export class LocalFileStorageService {
  private ready: Promise<void> | null = null;

  /**
   * Create every namespace directory once per process and verify the root is
   * actually writable. Called during startup so a misconfigured storage root
   * fails loudly and immediately instead of on the first upload.
   */
  ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        for (const namespace of ALL_NAMESPACES) {
          await fs.promises.mkdir(namespaceDir(namespace), {
            recursive: true,
            mode: dirModeFor(namespace),
          });
          // `mkdir` applies `mode` only when it creates the directory and is
          // masked by the process umask, so the mode is re-applied explicitly.
          await fs.promises.chmod(namespaceDir(namespace), dirModeFor(namespace));
        }

        await this.assertWritable(storageConfig.root);
      })().catch((error) => {
        // Reset so a later call can retry after a transient failure.
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }

  /**
   * Prove the storage root is writable by creating and removing a probe file.
   * A read-only or root-owned mount is a deployment error, not something to
   * discover when a customer's upload silently fails.
   */
  private async assertWritable(root: string): Promise<void> {
    const probe = path.join(root, `.write-probe-${process.pid}-${randomBytes(6).toString('hex')}`);
    try {
      await fs.promises.writeFile(probe, 'ok', { mode: 0o600 });
      await fs.promises.unlink(probe);
    } catch (error) {
      throw new StorageError(
        `Storage root "${root}" is not writable by this process. Check ownership/permissions of the storage directory.`,
        error,
      );
    }
  }

  /**
   * Atomically write a file inside a namespace.
   *
   * The payload lands on a uniquely named temp file in the *destination*
   * directory (same filesystem, so `rename` is atomic) and is only then moved
   * into place. Readers therefore observe either the previous content or the
   * complete new content — never a truncated file.
   */
  async write(
    namespace: StorageNamespace,
    relativePath: string,
    data: Buffer,
  ): Promise<string> {
    await this.ensureReady();

    const absolutePath = resolveStoragePath(namespace, relativePath);
    const directory = path.dirname(absolutePath);
    const mode = fileModeFor(namespace);

    await fs.promises.mkdir(directory, { recursive: true, mode: dirModeFor(namespace) });
    await fs.promises.chmod(directory, dirModeFor(namespace));

    const temporaryPath = path.join(
      directory,
      `.${path.basename(absolutePath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`,
    );

    try {
      await fs.promises.writeFile(temporaryPath, data, { mode });
      await fs.promises.chmod(temporaryPath, mode);
      await fs.promises.rename(temporaryPath, absolutePath);
    } catch (error) {
      await fs.promises.unlink(temporaryPath).catch(() => undefined);
      throw new StorageError(`Failed to write "${relativePath}" to local storage.`, error);
    }

    return absolutePath;
  }

  /** Read a whole file into memory. */
  async read(namespace: StorageNamespace, relativePath: string): Promise<Buffer> {
    const absolutePath = resolveStoragePath(namespace, relativePath);
    try {
      return await fs.promises.readFile(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        throw new StorageError(`File not found in storage: ${relativePath}`, error);
      }
      throw new StorageError(`Failed to read "${relativePath}" from local storage.`, error);
    }
  }

  /**
   * Open a read stream. The caller owns the returned stream and is responsible
   * for destroying it if the response is aborted before it finishes.
   */
  createReadStream(namespace: StorageNamespace, relativePath: string): fs.ReadStream {
    return fs.createReadStream(resolveStoragePath(namespace, relativePath));
  }

  /** Stat a file, returning `null` when it does not exist. */
  async stat(namespace: StorageNamespace, relativePath: string): Promise<StoredFileStats | null> {
    const absolutePath = resolveStoragePath(namespace, relativePath);
    try {
      const stats = await fs.promises.stat(absolutePath);
      if (!stats.isFile()) return null;
      return { size: stats.size, modifiedAt: stats.mtimeMs };
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw new StorageError(`Failed to stat "${relativePath}" in local storage.`, error);
    }
  }

  /** Delete a file. Returns `false` when it was already gone. Never throws. */
  async remove(namespace: StorageNamespace, relativePath: string): Promise<boolean> {
    const absolutePath = resolveStoragePath(namespace, relativePath);
    try {
      await fs.promises.unlink(absolutePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
      console.error(
        `[Storage] Failed to remove "${relativePath}" from the "${namespace}" namespace:`,
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }
}

export default new LocalFileStorageService();
