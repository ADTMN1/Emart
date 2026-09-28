/**
 * Browser-side ID-document preparation for "Become a Seller" submissions.
 *
 * Photographic identities (JPEG/PNG/WebP) are downscaled and re-encoded to a
 * compressed JPEG in memory — real uploads shrink from several MB to a few
 * hundred KB, dramatically reducing submission latency. The user's original
 * file is never modified or written anywhere; only an in-memory upload copy is
 * created (and, when compression would not help, the original file is sent
 * untouched). PDFs and any unsupported type are never touched.
 *
 * This is a performance optimization ONLY: the backend still independently
 * re-validates every uploaded file (size, MIME, extension), so a corrupted or
 * malicious client payload can never bypass server-side rules.
 */

const COMPRESSIBLE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Largest edge of the compressed image. ID text stays readable at 1600px. */
const MAX_DIMENSION = 1600;

/** Target compressed size (~200–500 KB). Larger images just get bigger. */
const TARGET_MAX_BYTES = 500 * 1024;

/** Quality ladder — halts early as soon as the size target is met. */
const QUALITIES = [0.85, 0.72, 0.6];

export interface PreparedIdentityDocument {
  /** The file the backend should receive (compressed copy or the original). */
  file: File;
  /** True when the backend receives a compressed copy instead of the original. */
  wasCompressed: boolean;
  originalBytes: number;
  uploadedBytes: number;
  /** JPEG quality used, shown to the seller for transparency. */
  quality?: number;
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be read.'));
    };
    img.src = url;
  });
}

/**
 * Downscale (only ever downscale, never upscale) and encode as JPEG on a white
 * backing, so PNG transparency cannot collapse to black. Returns the encoded
 * blob and the quality used, or null if encoding failed.
 */
function encodeJpeg(img: HTMLImageElement, quality: number): Promise<Blob | null> {
  const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = maxSide > MAX_DIMENSION ? MAX_DIMENSION / maxSide : 1;
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

/** Rename a compressed copy so the extension matches its JPEG encoding. */
function jpegName(originalName: string): string {
  const base = originalName.replace(/\.(png|webp)$/i, '');
  return `${base || 'id-document'}.jpg`;
}

/**
 * Prepare an upload copy of the user's ID document. Falls back to the original
 * file whenever compression is not appropriate (PDF, unsupported type, decode
 * error, or a result that would not actually be smaller).
 */
export async function prepareIdentityDocument(
  input: File,
): Promise<PreparedIdentityDocument> {
  const originalBytes = input.size;

  // PDFs (and anything non-image) are never compressed or modified.
  if (!COMPRESSIBLE_MIME_TYPES.has(input.type)) {
    return { file: input, wasCompressed: false, originalBytes, uploadedBytes: originalBytes };
  }

  try {
    const img = await loadImage(input);

    let best: Blob | null = null;
    let bestQuality = QUALITIES[0];
    for (const quality of QUALITIES) {
      const blob = await encodeJpeg(img, quality);
      if (!blob || blob.size === 0) continue;
      if (!best || blob.size < best.size) {
        best = blob;
        bestQuality = quality;
      }
      if (blob.size <= TARGET_MAX_BYTES) break;
    }

    // Keep the original when compression would not shrink the upload.
    if (!best || best.size >= originalBytes) {
      return { file: input, wasCompressed: false, originalBytes, uploadedBytes: originalBytes };
    }

    const compressed = new File([best], jpegName(input.name), { type: 'image/jpeg' });
    return {
      file: compressed,
      wasCompressed: true,
      originalBytes,
      uploadedBytes: compressed.size,
      quality: bestQuality,
    };
  } catch {
    // A decode failure must never block submission — send the original file and
    // let the backend's server-side validation decide.
    return { file: input, wasCompressed: false, originalBytes, uploadedBytes: originalBytes };
  }
}

export default prepareIdentityDocument;