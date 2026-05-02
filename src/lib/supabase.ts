import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.MYSTORE_NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.MYSTORE_NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client (uses anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (uses service role key — server only)
export const supabaseAdmin = () =>
  createClient(supabaseUrl, process.env.MYSTORE_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
