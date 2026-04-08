import { z } from 'zod';

// ── Leaderboard entry validation ────────────────────────────────────────────

const noHtml  = (val: string) => !/<[^>]*>/.test(val);
const noNulls = (val: string) => !val.includes('\0');

export const LeaderboardEntrySchema = z.object({
  player_name:    z.string().trim().min(1).max(32)
    .refine(noHtml, 'HTML not allowed')
    .refine(noNulls, 'Null bytes not allowed'),
  total_damage:   z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  max_combo:      z.number().int().min(0).max(9999),
  boss_kills:     z.number().int().min(0).max(999),
  time_played_s:  z.number().int().min(0).max(86_400 * 30), // max 30 days
}).strict();

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
