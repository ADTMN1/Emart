import * as React from 'react';
import { Loader2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — matches the backend cap
const MAX_FILE_MB = Math.round(MAX_FILE_BYTES / 1024 / 1024);

interface SellerShopMediaUploadProps {
  kind: 'logo' | 'banner';
  /** Recomputed guideline shown to the seller (e.g. "1:1" for a logo). */
  aspectHint: string;
  /** Optional pixel guideline (e.g. "512×512"). */
  dimensionHint: string;
  currentUrl: string | null;
  /** Persists an upload; the backend stores it on the seller profile. */
  upload: (file: File) => Promise<unknown>;
  /** Removes the current image from the seller profile. */
  remove: () => Promise<unknown>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reusable logo/banner upload widget for the Seller Center Shop menu. The
 * native file input stays hidden; a visible button opens it. Client-side
 * validation mirrors the server (MIME allow-list + 5 MB cap) so bad files are
 * rejected before any request is sent.
 */
export const SellerShopMediaUpload: React.FC<SellerShopMediaUploadProps> = ({
  kind,
  aspectHint,
  dimensionHint,
  currentUrl,
  upload,
  remove,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<'upload' | 'remove' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset the picker so re-selecting the same file still fires onChange.
  const openPicker = () => {
    setError(null);
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Clear the input value immediately so the same file can be chosen again.
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError('Unsupported file type. Upload a JPG, PNG, WEBP or AVIF image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `File is too large (${formatFileSize(file.size)}). Maximum size is ${MAX_FILE_MB} MB.`,
      );
      return;
    }

    try {
      setBusy('upload');
      setError(null);
      await upload(file);
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const handleRemove = async () => {
    try {
      setBusy('remove');
      setError(null);
      await remove();
    } catch (err: any) {
      setError(err?.message || 'Removal failed. Please try again.');
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const square = kind === 'logo';

  return (
    <Card>
      <CardContent className="p-5 lg:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* Preview / picker */}
          <div className="w-full shrink-0 sm:w-64">
            {currentUrl ? (
              <div
                className={`overflow-hidden rounded-xl border border-border bg-muted/40 ${
                  square ? 'aspect-square' : 'aspect-[3/1]'
                }`}
              >
                <img
                  src={currentUrl}
                  alt={`Current ${kind}`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={openPicker}
                disabled={busy !== null}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 ${
                  square ? 'aspect-square' : 'aspect-[3/1]'
                }`}
              >
                {busy === 'upload' ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <UploadCloud className="h-6 w-6" />
                )}
                <span className="text-xs font-medium">
                  {busy === 'upload' ? 'Uploading…' : 'Choose an image'}
                </span>
              </button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {aspectHint} recommended · {dimensionHint}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                leftIcon={busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                onClick={openPicker}
                disabled={busy !== null}
              >
                {currentUrl ? 'Replace image' : 'Upload image'}
              </Button>
              {currentUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  leftIcon={busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  onClick={handleRemove}
                  disabled={busy !== null}
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WEBP or AVIF · Max {MAX_FILE_MB} MB
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(',')}
          className="hidden"
          onChange={handleFile}
        />
      </CardContent>
    </Card>
  );
};

export default SellerShopMediaUpload;