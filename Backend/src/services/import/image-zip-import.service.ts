import yauzl from 'yauzl';
import { normalizeImportSku } from './product-row.validator';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_NAME = /^(.+)-([1-5])\.(jpe?g|png|webp|avif)$/i;

export interface ZipImage { sku: string; position: number; filename: string; buffer: Buffer; mimetype: string; }
export interface ImageZipIndex { provided: boolean; imagesBySku: Map<string, ZipImage[]>; warningsBySku: Map<string, string[]>; globalWarnings: string[]; invalidImages: number; skippedImages: number; }

function magicMime(buffer: Buffer): string | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp' && buffer.subarray(8, 12).toString('ascii').startsWith('avif')) return 'image/avif';
  return undefined;
}

function unsafePath(name: string): boolean {
  return name.startsWith('/') || name.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(name) || name.split(/[\\/]/).some((part) => part === '..');
}

function openZip(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (err, zip) => err || !zip ? reject(err || new Error('Invalid ZIP file')) : resolve(zip)));
}

function readEntry(zip: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (err, stream) => {
    if (err || !stream) return reject(err || new Error('Could not read ZIP entry'));
    const chunks: Buffer[] = []; let size = 0;
    stream.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_IMAGE_BYTES) { stream.destroy(new Error('Image exceeds 5 MB')); return; } chunks.push(chunk); });
    stream.on('error', reject); stream.on('end', () => resolve(Buffer.concat(chunks)));
  }));
}

/** Safely indexes an archive without extracting it to the filesystem. */
export async function indexImageZip(file: Express.Multer.File | undefined, csvSkus: Set<string>): Promise<ImageZipIndex> {
  const result: ImageZipIndex = { provided: !!file, imagesBySku: new Map(), warningsBySku: new Map(), globalWarnings: [], invalidImages: 0, skippedImages: 0 };
  if (!file) return result;
  let zip: yauzl.ZipFile;
  try { zip = await openZip(file.buffer); } catch { throw new Error('Invalid ZIP image archive'); }
  await new Promise<void>((resolve, reject) => {
    const fail = (message: string) => { result.globalWarnings.push(message); result.invalidImages += 1; };
    zip.on('error', reject);
    zip.on('entry', async (entry: yauzl.Entry) => {
      try {
        if (unsafePath(entry.fileName)) { fail(`Ignored unsafe ZIP path "${entry.fileName}"`); return; }
        if (/\/$/.test(entry.fileName)) return;
        if (entry.fileName.includes('/') || entry.fileName.includes('\\')) { fail(`Ignored incorrectly named image "${entry.fileName}"`); return; }
        const name = entry.fileName;
        const match = IMAGE_NAME.exec(name);
        if (!match) { fail(`Ignored incorrectly named image "${entry.fileName}"`); return; }
        const sku = normalizeImportSku(match[1]); const position = Number(match[2]);
        if (!sku || !csvSkus.has(sku)) { result.globalWarnings.push(`Ignored image "${name}": SKU is not in this CSV`); result.skippedImages += 1; return; }
        if (entry.uncompressedSize > MAX_IMAGE_BYTES) { (result.warningsBySku.get(sku) || result.warningsBySku.set(sku, []).get(sku)!).push(`${name} exceeds 5 MB and was ignored`); result.invalidImages += 1; return; }
        const images = result.imagesBySku.get(sku) || [];
        if (images.some((image) => image.position === position)) { (result.warningsBySku.get(sku) || result.warningsBySku.set(sku, []).get(sku)!).push(`Duplicate image position ${position} in ZIP; ${name} was ignored`); result.invalidImages += 1; return; }
        let content: Buffer;
        try { content = await readEntry(zip, entry); } catch { (result.warningsBySku.get(sku) || result.warningsBySku.set(sku, []).get(sku)!).push(`${name} is corrupted or exceeds 5 MB and was ignored`); result.invalidImages += 1; return; }
        const mimetype = magicMime(content);
        if (!mimetype) { (result.warningsBySku.get(sku) || result.warningsBySku.set(sku, []).get(sku)!).push(`${name} has unsupported or invalid image contents and was ignored`); result.invalidImages += 1; return; }
        images.push({ sku, position, filename: name, buffer: content, mimetype }); result.imagesBySku.set(sku, images);
      } catch (error) { reject(error); return; } finally { zip.readEntry(); }
    });
    zip.on('end', resolve); zip.readEntry();
  });
  return result;
}
