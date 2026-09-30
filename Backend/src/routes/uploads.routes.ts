import { Router } from 'express';
import express from 'express';
import { PUBLIC_STORAGE_NAMESPACES, namespaceDir, storageConfig } from '../config/storage';

/**
 * Static delivery of the PUBLIC storage namespaces.
 *
 * Only the namespaces listed in `PUBLIC_STORAGE_NAMESPACES` are mounted here
 * (product images and seller storefront media). The private `seller-documents`
 * namespace is deliberately absent: it is never aliased, never reachable over
 * HTTP without a signed token, and its only read path is the authenticated
 * stream endpoint.
 *
 * Nginx may serve the very same directories directly for offload; when it does,
 * it must alias the identical public subtrees and must never alias
 * `seller-documents`.
 */
const router = Router();

for (const namespace of PUBLIC_STORAGE_NAMESPACES) {
  router.use(
    `${storageConfig.publicPathPrefix}/${namespace}`,
    express.static(namespaceDir(namespace), {
      // No directory listings, no dotfiles.
      index: false,
      dotfiles: 'deny',
      // Stored filenames are timestamp-prefixed and never overwritten in
      // place, so a stored asset is immutable and can be cached hard. A
      // replacement upload produces a new URL, which is what busts the cache.
      maxAge: '365d',
      immutable: true,
      // A missing file must fall through to the API's 404 handler rather than
      // being swallowed here.
      fallthrough: true,
      setHeaders(res) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
}

export default router;
