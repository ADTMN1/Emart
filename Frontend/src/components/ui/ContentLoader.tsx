import * as React from 'react'

/**
 * Quiet, static placeholder rendered inside the main content column while a
 * lazily-loaded route chunk is fetched (on first visit only). It is not a
 * full-page loading screen: the shared layouts (navbar/sidebar/footer) stay
 * mounted unchanged, and this merely reserves the content space so the page
 * does not collapse and jump. No animation → no perceived "flash".
 */
export const ContentLoader: React.FC = () => (
  <div className="space-y-6 py-6" role="status" aria-label="Loading content">
    <div className="h-8 w-48 rounded-lg bg-muted" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="h-44 rounded-xl bg-muted" />
      <div className="h-44 rounded-xl bg-muted" />
      <div className="h-44 rounded-xl bg-muted" />
    </div>
    <div className="h-64 rounded-xl bg-muted" />
  </div>
)

export default ContentLoader