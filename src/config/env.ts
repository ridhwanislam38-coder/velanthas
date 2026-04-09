import { z } from 'zod';

// ── Environment variable validation ────────────────────────────────────────
// Validates all VITE_ env vars at startup.
// App fails fast with clear error if required vars are missing.
// Rule: only VITE_ prefixed vars exist in this file — never service keys.
//       SUPABASE_SERVICE_KEY is server-only — never in this bundle.

const envSchema = z.object({
  // Required for Supabase
  VITE_SUPABASE_URL:      z.string().url({ message: 'VITE_SUPABASE_URL must be a valid URL' }),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, { message: 'VITE_SUPABASE_ANON_KEY too short' }),

  // Optional — AI tool pipeline
  VITE_ELEVENLABS_API_KEY:    z.string().min(10).optional(),
  VITE_FREESOUND_API_KEY:     z.string().min(10).optional(),
  VITE_RETRODIFFUSION_API_KEY:z.string().min(10).optional(),

  // Injected by Vite — always present
  MODE:         z.enum(['development', 'test', 'production']),
  DEV:          z.boolean(),
  PROD:         z.boolean(),
  SSR:          z.boolean(),
});

// Parse at module load time — fails fast on missing/invalid vars.
// In production: missing VITE_SUPABASE_URL throws immediately.
// In development: missing vars show a clear error in console.
function parseEnv(): z.infer<typeof envSchema> {
  const raw = {
    VITE_SUPABASE_URL:          import.meta.env['VITE_SUPABASE_URL'],
    VITE_SUPABASE_ANON_KEY:     import.meta.env['VITE_SUPABASE_ANON_KEY'],
    VITE_ELEVENLABS_API_KEY:    import.meta.env['VITE_ELEVENLABS_API_KEY'],
    VITE_FREESOUND_API_KEY:     import.meta.env['VITE_FREESOUND_API_KEY'],
    VITE_RETRODIFFUSION_API_KEY:import.meta.env['VITE_RETRODIFFUSION_API_KEY'],
    MODE:                       import.meta.env['MODE'],
    DEV:                        import.meta.env['DEV'],
    PROD:                       import.meta.env['PROD'],
    SSR:                        import.meta.env['SSR'],
  };

  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    console.error(`[Velanthas] Environment variable validation failed:\n${missing}`);

    if (import.meta.env['PROD']) {
      throw new Error(`[Velanthas] Missing required environment variables. Check Vercel env config.`);
    }
  }

  // Return data or best-effort fallback (dev only)
  return result.data ?? (raw as z.infer<typeof envSchema>);
}

export const env = parseEnv();

// ── Helper: is Supabase configured? ──────────────────────────────────────
export const supabaseConfigured = !!(
  import.meta.env['VITE_SUPABASE_URL'] &&
  import.meta.env['VITE_SUPABASE_ANON_KEY']
);

// ── Security note (for developers) ───────────────────────────────────────
// SUPABASE_ANON_KEY is safe to include in client bundles ONLY IF:
//   1. Row Level Security (RLS) is enabled on all tables.
//   2. Policies restrict users to reading/writing ONLY their own data.
//   3. No admin functionality uses the anon key.
// DO NOT add SUPABASE_SERVICE_KEY here — it bypasses RLS.
// Rotate VITE_SUPABASE_ANON_KEY every 90 days via Supabase dashboard.
// Last rotated: [DATE — update this comment when rotating]
