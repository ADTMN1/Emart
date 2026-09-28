import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { getAuthProfile } from '@/lib/api';
import { OAUTH_RETURN_PATH_KEY, resolvePostAuthDestination } from '@/lib/postAuthRedirect';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { setAuthData } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const handleCallback = async () => {
      // Consume any pre-OAuth return path saved by the Login page's Google
      // handler. It is removed immediately so a stale destination can never
      // redirect a later, unrelated login, and it is re-validated below with
      // the same rules as the email/password flow (bare internal paths only).
      const oauthReturnPath = window.sessionStorage.getItem(OAUTH_RETURN_PATH_KEY);
      window.sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);

      const token = searchParams.get('token');

      if (!token) {
        setError('No authentication token received');
        toast({
          variant: 'error',
          title: 'Authentication Failed',
          description: 'No authentication token received.',
        });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      try {
        // Store token temporarily in localStorage so api.get can use it
        localStorage.setItem('emart_token', token);

        // Fetch user profile using the token. getAuthProfile shares the
        // in-flight request with AuthProvider's own init, so this and the
        // provider's restore never issue two /auth/profile calls.
        const userData = await getAuthProfile();
        
        // Update auth context with token and user data
        setAuthData(token, userData);
        
        toast({
          variant: 'success',
          title: 'Welcome!',
          description: 'You have successfully signed in with Google.',
        });
        
        // ROLE SEPARATION — the same rule as the password flow: ADMIN → /admin,
        // SELLER → /seller, and only a CUSTOMER restores the intended
        // destination. Seller-application status is never consulted for routing.
        // A stored path can never override authorization either — the seller
        // and admin gates still run against the incoming session.
        // Split the stored candidate back into pathname + search so the shared
        // validator applies its route blocklist to the path alone (query
        // strings can never be used to smuggle a blocked route through).
        const qIndex = oauthReturnPath?.indexOf('?') ?? -1;
        const returnFrom =
          oauthReturnPath && qIndex !== -1
            ? { pathname: oauthReturnPath.slice(0, qIndex), search: oauthReturnPath.slice(qIndex) }
            : oauthReturnPath
              ? { pathname: oauthReturnPath }
              : null;
        navigate(resolvePostAuthDestination(userData.role, returnFrom), { replace: true });
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'Authentication failed');
        
        // Clear invalid token
        localStorage.removeItem('emart_token');
        
        toast({
          variant: 'error',
          title: 'Authentication Failed',
          description: err.message || 'Could not complete Google sign-in. Please try again.',
        });
        
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast, setAuthData]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {!error ? (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Completing authentication...</p>
          </>
        ) : (
          <>
            <div className="inline-block rounded-full h-12 w-12 bg-destructive/10 text-destructive flex items-center justify-center">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="mt-4 text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
