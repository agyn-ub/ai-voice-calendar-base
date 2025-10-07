import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Create a Supabase client with the service role key for admin operations
// This should only be used on the server side (API routes, server components)
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export default supabaseAdmin;