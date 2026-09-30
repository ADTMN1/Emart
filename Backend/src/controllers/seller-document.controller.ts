import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import sellerService from '../services/seller.service';
import sellerDocumentStorageService, {
  SellerDocumentStream,
} from '../services/seller-document-storage.service';
import { sendSuccess } from '../utils/response';

/**
 * Seller identity-document delivery.
 *
 * Private documents are never served from a public directory. This controller
 * is the single read path for them and it offers two equivalent entry points:
 *
 *  • `downloadSigned` — no Authorization header (the browser opens the URL in
 *    a new tab). The HMAC-signed, expiring token is the credential.
 *  • `streamApplicationDocument` — ADMIN only, normal Bearer authentication,
 *    for API clients that would rather stream the bytes directly.
 *
 * Both funnel into the same streaming helper, so authorization, headers and
 * abort handling cannot drift apart between the two.
 */
class SellerDocumentController {
  /**
   * GET /api/v1/seller-documents/download?token=...
   *
   * Streams a document for a valid, unexpired signed token.
   */
  async downloadSigned(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = typeof req.query.token === 'string' ? req.query.token : '';
      const { path } = sellerDocumentStorageService.verifyDocumentToken(token);
      const document = await sellerDocumentStorageService.openSellerDocument(path);
      this.streamDocument(res, document);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/admin/sellers/applications/:id/document/content
   *
   * ADMIN only (router gate). Streams the applicant's document directly.
   */
  async streamApplicationDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { path, mimetype } = await sellerService.getApplicationDocument(req.params.id);
      const document = await sellerDocumentStorageService.openSellerDocument(path, mimetype ?? undefined);
      this.streamDocument(res, document);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Pipe a document to the response. `inline` is used so a PDF or image is
   * previewable in the tab instead of being silently downloaded, matching the
   * behaviour admins had with Supabase's signed URLs.
   */
  private streamDocument(res: Response, document: SellerDocumentStream): void {
    res.setHeader('Content-Type', document.mimetype);
    res.setHeader('Content-Length', String(document.size));
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${document.filename.replace(/"/g, '')}"`,
    );
    // Identity documents must never be cached by shared caches or the browser.
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // If the client aborts (closed tab, navigation away), tear the read
    // stream down instead of leaking the file descriptor.
    res.on('close', () => {
      if (!res.writableEnded) document.stream.destroy();
    });

    document.stream.on('error', (error) => {
      console.error('[SellerDocument] Stream error:', error);
      res.destroy(error);
    });

    document.stream.pipe(res);
  }
}

export { SellerDocumentController };
export default new SellerDocumentController();
