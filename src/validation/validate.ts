import { z } from 'zod';

// ── Safe validate helper ───────────────────────────────────────────────────
// Validates data against a Zod schema before any Supabase call.
// Returns { data } on success or { error } on failure — never throws.
//
// Usage:
//   const result = validate(PlayerSaveSchema, rawData);
//   if (result.error) { console.warn('Invalid save data', result.error); return; }
//   await supabase.from('player_saves').upsert(result.data);

export type ValidationResult<T> =
  | { data: T; error: null }
  | { data: null;  error: string };

export function validate<T>(
  schema: z.ZodType<T>,
  input: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { data: result.data, error: null };
  }

  const message = result.error.issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('; ');

  // Never log the raw input — it may contain sensitive data
  console.warn('[Validation] Failed:', message);
  return { data: null, error: message };
}

// ── Safe JSON parse ────────────────────────────────────────────────────────
// Always parse JSON through this — never JSON.parse() raw user input directly.
export function safeJsonParse<T>(
  schema: z.ZodType<T>,
  raw: string,
): ValidationResult<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { data: null, error: 'Invalid JSON' };
  }
  return validate(schema, parsed);
}
