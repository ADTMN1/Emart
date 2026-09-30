import path from 'path';
import config from './env';

/**
 * Local filesystem storage configuration.
 *
 * EMART no longer depends on Supabase (or any other object store) for file
 * persistence. Every uploaded file lives on the local disk under a single
 * storage root, partitioned into three namespaces:
 *
 *   <STORAGE_ROOT>/
 *   ├── products/          PUBLIC   — product & seller-product images
 *   ├── shop-media/        PUBLIC   — seller storefront logos and banners
 *   └── seller-documents/  PRIVATE  — seller identity documents
 *
 * Two invariants hold for every namespace:
 *
 *  1. PostgreSQL only ever stores the RELATIVE storage path
 *     (e.g. `cm123/1712345-photo.jpg`). Absolute filesystem paths are never
 *     persisted, so the storage root can move without touching the database.
 *  2. PUBLIC namespaces are reachable over HTTP at
 *     `<PUBLIC_BASE_URL><PUBLIC_PATH_PREFIX>/<namespace>/<storage-path>`.
 *     PRIVATE namespaces are never mounted, never aliased and never given a
 *     public URL — they are only readable through an authenticated,
 *     short-lived backend stream endpoint (see seller-document-storage).
 */

/** Every directory that lives under the storage root. */
export const STORAGE_NAMESPACE = {
  /** Product images (admin + seller products share this pipeline). */
  products: 'products',
  /** Seller storefront logos and banners. */
  shopMedia: 'shop-media',
  /** Seller identity documents — private, never served publicly. */
  sellerDocuments: 'seller-documents',
} as const;

export type StorageNamespace = (typeof STORAGE_NAMESPACE)[keyof typeof STORAGE_NAMESPACE];

/** Namespaces that are safe to expose over HTTP. */
export const PUBLIC_STORAGE_NAMESPACES: readonly StorageNamespace[] = [
  STORAGE_NAMESPACE.products,
  STORAGE_NAMESPACE.shopMedia,
];

/** Namespaces that must never be served statically. */
export const PRIVATE_STORAGE_NAMESPACES: readonly StorageNamespace[] = [
  STORAGE_NAMESPACE.sellerDocuments,
];

/** Owner-only on disk — the app user is the only account that may read these. */
const PRIVATE_DIR_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
/** World-readable so Nginx (or any other process) can serve the public tree. */
const PUBLIC_DIR_MODE = 0o755;
const PUBLIC_FILE_MODE = 0o644;

/** Normalize a URL path prefix to `/segment` with no trailing slash. */
function normalizePathPrefix(value: string): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash === '/' ? '' : withLeadingSlash;
}

const storageRoot = path.resolve(config.storage.root || '/var/lib/emart/storage');
const publicPathPrefix = normalizePathPrefix(config.storage.publicPathPrefix || '/uploads');
const publicBaseUrl = (config.storage.publicBaseUrl || '').replace(/\/+$/, '');

if (!publicPathPrefix) {
  throw new Error(
    'STORAGE_PUBLIC_PATH_PREFIX resolved to an empty path. ' +
      'Set it to the URL prefix that serves the public upload directories (e.g. /uploads).',
  );
}

export const storageConfig = {
  /** Absolute path of the storage root directory. */
  root: storageRoot,
  /** URL path prefix under which the public namespaces are served. */
  publicPathPrefix,
  /**
   * Origin (optionally with a path prefix) that serves `publicPathPrefix` and
   * the API. Empty string means "same origin as the API", which yields
   * root-relative URLs.
   */
  publicBaseUrl,
  /** TTL of a minted identity-document download token, in seconds. */
  documentUrlTtlSeconds:
    Number.isFinite(config.storage.documentUrlTtlSeconds) && config.storage.documentUrlTtlSeconds > 0
      ? Math.floor(config.storage.documentUrlTtlSeconds)
      : 300,
} as const;

export function isPrivateNamespace(namespace: StorageNamespace): boolean {
  return PRIVATE_STORAGE_NAMESPACES.includes(namespace);
}

/** Directory mode a namespace's files must be created with. */
export function fileModeFor(namespace: StorageNamespace): number {
  return isPrivateNamespace(namespace) ? PRIVATE_FILE_MODE : PUBLIC_FILE_MODE;
}

/** Directory mode a namespace's directories must be created with. */
export function dirModeFor(namespace: StorageNamespace): number {
  return isPrivateNamespace(namespace) ? PRIVATE_DIR_MODE : PUBLIC_DIR_MODE;
}

/** Absolute directory of a namespace, e.g. `/var/lib/emart/storage/products`. */
export function namespaceDir(namespace: StorageNamespace): string {
  return path.join(storageConfig.root, namespace);
}

/**
 * Validate a relative storage path and return it in canonical form
 * (`a/b/c.jpg`, no leading slash, no `.`/`..` segments, no empty segments).
 *
 * Storage paths reach this module from the database as well as from freshly
 * generated names, so they are treated as untrusted input: traversal attempts,
 * absolute paths and NUL bytes are rejected outright rather than normalized
 * away, because silently rewriting them would let a caller address a file
 * outside its namespace.
 */
export function normalizeStoragePath(relativePath: string): string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) {
    throw new Error('Storage path must be a non-empty string.');
  }
  if (relativePath.includes('\0')) {
    throw new Error('Storage path must not contain NUL bytes.');
  }
  if (path.isAbsolute(relativePath) || /^[A-Za-z]:[\\/]/.test(relativePath)) {
    throw new Error(`Storage path must be relative: ${relativePath}`);
  }

  const segments = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');

  if (segments.length === 0) {
    throw new Error('Storage path must contain at least one segment.');
  }
  for (const segment of segments) {
    if (segment === '..') {
      throw new Error(`Storage path must not traverse directories: ${relativePath}`);
    }
  }

  return segments.join('/');
}

/**
 * Resolve a relative storage path to an absolute path inside its namespace and
 * assert that the result really is contained by that namespace. The
 * containment check is the last line of defence: even if a future path
 * normalizer regresses, nothing outside the namespace can ever be addressed.
 */
export function resolveStoragePath(namespace: StorageNamespace, relativePath: string): string {
  const safeRelativePath = normalizeStoragePath(relativePath);
  const base = namespaceDir(namespace);
  const resolved = path.resolve(base, ...safeRelativePath.split('/'));

  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Storage path escapes the "${namespace}" namespace: ${relativePath}`);
  }

  return resolved;
}

/**
 * Build the public URL for a file in a PUBLIC namespace. The origin, the URL
 * prefix and the namespace all come from configuration — nothing is hardcoded.
 *
 * Each path segment is percent-encoded so spaces and non-ASCII characters in an
 * uploaded filename survive the round-trip, while the separators stay intact.
 */
export function publicFileUrl(namespace: StorageNamespace, relativePath: string): string {
  if (isPrivateNamespace(namespace)) {
    throw new Error(
      `Namespace "${namespace}" is private and must never be exposed through a public URL.`,
    );
  }

  const encoded = normalizeStoragePath(relativePath)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${storageConfig.publicBaseUrl}${storageConfig.publicPathPrefix}/${namespace}/${encoded}`;
}

/**
 * Absolute URL of a backend API route, built from configuration so it is valid
 * in same-origin deployments (relative) and cross-origin ones (absolute).
 */
export function apiUrl(routePath: string): string {
  const normalized = normalizePathPrefix(routePath);
  return `${storageConfig.publicBaseUrl}/api/${config.apiVersion}${normalized}`;
}
