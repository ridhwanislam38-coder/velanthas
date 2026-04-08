import { createClient } from '@supabase/supabase-js';
import { supabaseConfigured } from '../config/env';

// ── Supabase client singleton ──────────────────────────────────────────────
// Uses ANON key — relies on Row Level Security (RLS) for data isolation.
// NEVER use the service key here — it bypasses RLS.
//
// RLS requirement: ALL tables must have policies restricting users to
// reading/writing ONLY their own rows (auth.uid() = user_id).

export const supabase = supabaseConfigured
  ? createClient(
      import.meta.env['VITE_SUPABASE_URL'] as string,
      import.meta.env['VITE_SUPABASE_ANON_KEY'] as string,
      {
        auth: {
          // Persist session in localStorage — acceptable for a game client
          persistSession:     true,
          autoRefreshToken:   true,
          detectSessionInUrl: false,
        },
      },
    )
  : null;
