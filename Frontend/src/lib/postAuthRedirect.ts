import type { UserRole } from '@/types/role';

/**
 * sessionStorage key that carries the intended internal destination from the
 * Login page's Google sign-in button across the OAuth round-trip. Only a
 * validated bare path (e.g. "/cart") is ever stored — never tokens or user
 * data — and AuthCallback removes it as soon as it is consumed.
 */
export const OAUTH_RETURN_PATH_KEY = 'emart_oauth_return_path';

/**
 * Resolve a safe post-login destination from a guarded route's
 * location.state.from (the target that redirected an unauthenticated user to
 * /login). Only bare absolute paths are accepted — every other value,
 * including protocol-relative (//host), scheme-bearing (https:…),
 * backslash-escaped URLs and the auth pages themselves, falls back to "/" so
 * login can never be abused as an open redirect.
 */
export function resolvePostLoginDestination(from: unknown): string {
  if (!from || typeof from !== 'object') return '/'
  const { pathname, search } = from as { pathname?: unknown; search?: unknown }
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return '/'
  const candidate = pathname + (typeof search === 'string' ? search : '')
  if (
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) ||
    // Blocklist is checked on the pathname alone so a blocked route can never
    // be smuggled through a query string (e.g. "/auth/callback?token=…").
    ['/login', '/register', '/auth/callback'].some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return '/'
  }
  return candidate
}

/**
 * The single post-authentication redirect decision, shared by the password
 * login flow and the Google OAuth callback so the two can never disagree.
 *
 * EMART ROLE SEPARATION — the role, and only the role, decides:
 *   ADMIN    → /admin          (admin-only; never a buyer)
 *   SELLER   → /seller         (seller-only; the Seller Center is its home)
 *   CUSTOMER → the intended internal destination when there is one (e.g. the
 *               /cart the visitor tried to open, or /seller from an approval
 *               email), otherwise "/".
 *
 * The role comes from the freshly issued token / /auth/profile response, NOT
 * from SellerApplication/SellerProfile status: a CUSTOMER whose application is
 * PENDING or REJECTED is still a buyer and must not be pushed into a seller
 * console it cannot use.
 */
export function resolvePostAuthDestination(role: UserRole | string, from: unknown): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'SELLER') return '/seller'
  return resolvePostLoginDestination(from)
}
