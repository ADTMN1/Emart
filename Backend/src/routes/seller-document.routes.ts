import { Router } from 'express';
import sellerDocumentController from '../controllers/seller-document.controller';

/**
 * Private seller identity-document delivery.
 *
 * This router is intentionally NOT behind `authenticate`: the URL is opened by
 * the browser in a new tab, which cannot attach an Authorization header. The
 * credential is instead the short-lived HMAC-signed token minted by the
 * ADMIN-only application document route. No file in the private
 * `seller-documents` namespace is ever reachable without one.
 */
const router = Router();

router.get('/download', sellerDocumentController.downloadSigned.bind(sellerDocumentController));

export default router;
