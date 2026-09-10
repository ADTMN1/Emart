import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration for Server-Side Storage Operations
 * 
 * IMPORTANT: This client uses the SECRET_KEY and should NEVER be exposed to the frontend.
 * The secret key provides full admin access to Supabase services including Storage.
 */

// Validate required environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    'SUPABASE_URL is not defined in environment variables. ' +
    'Please add it to your .env file.'
  );
}

if (!supabaseSecretKey) {
  throw new Error(
    'SUPABASE_SECRET_KEY is not defined in environment variables. ' +
    'Please add it to your .env file. ' +
    'WARNING: Never use SUPABASE_PUBLISHABLE_KEY for server-side operations.'
  );
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  throw new Error(
    `SUPABASE_URL is not a valid URL: ${supabaseUrl}. ` +
    'Expected format: https://your-project.supabase.co'
  );
}

/**
 * Server-side Supabase client with admin privileges
 * 
 * This client bypasses Row Level Security (RLS) policies and has full access
 * to all Supabase services including Storage.
 * 
 * Use this client for:
 * - Uploading files to Storage
 * - Deleting files from Storage
 * - Managing Storage buckets
 * - Any server-side Storage operations
 * 
 * @example
 * ```typescript
 * import supabase from '@/config/supabase';
 * 
 * // Upload file
 * const { data, error } = await supabase.storage
 *   .from('product-images')
 *   .upload('path/to/file.jpg', fileBuffer);
 * ```
 */
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, options = {}) => {
      // Increase timeout from default 10s to 60s
      return fetch(url, {
        ...options,
        // @ts-ignore - Node.js fetch API
        timeout: 60000,
      });
    },
  },
});

// Log configuration status (without exposing secrets)
if (process.env.NODE_ENV === 'development') {
  console.log('[Supabase] Client initialized successfully');
  console.log('[Supabase] URL:', supabaseUrl);
  console.log('[Supabase] Using SECRET_KEY (admin access)');
}

export default supabase;
