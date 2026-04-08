import { supabase } from './client';
import type { PlayerData } from '../types/game';
import type { SaveRow, LeaderboardRow } from '../types/supabase';
import { validate } from '../validation/validate';
import { LeaderboardEntrySchema } from '../validation/schemas/leaderboardSchema';
import { z } from 'zod';

// ── Database operations — all inputs validated before Supabase calls ────────
// Every mutation: validate first, never pass raw data to DB layer.
// Supabase client uses anon key + RLS — users can only access own rows.

// Minimal save payload schema (full schema in saveStateSchema.ts)
const SavePayloadSchema = z.object({
  region:     z.string().max(50).optional(),
  position_x: z.number().finite().optional(),
  position_y: z.number().finite().optional(),
  hp:         z.number().int().min(0).max(99_999).optional(),
  max_hp:     z.number().int().min(1).max(99_999).optional(),
}).strip(); // remove any unknown fields

export async function saveProgress(player: PlayerData, saveId: string | null): Promise<string | null> {
  if (!supabase) return null;

  const payload = {
    hp:     player.hp,
    max_hp: player.maxHp,
  };

  const validated = validate(SavePayloadSchema, payload);
  if (validated.error || !validated.data) {
    console.warn('[queries] saveProgress: validation failed —', validated.error);
    return null;
  }

  const safeData = validated.data;

  if (saveId) {
    const { error } = await supabase
      .from('player_saves')
      .update({ ...safeData, updated_at: new Date().toISOString() })
      .eq('id', saveId);

    if (error) { console.error('[queries] saveProgress update failed', error.message); return null; }
    return saveId;
  } else {
    const { data, error } = await supabase
      .from('player_saves')
      .insert(safeData)
      .select('id')
      .single();

    if (error) { console.error('[queries] saveProgress insert failed', error.message); return null; }
    return (data as { id: string }).id;
  }
}

export async function loadProgress(saveId: string): Promise<SaveRow | null> {
  if (!supabase) return null;

  // saveId comes from localStorage — validate it's a UUID before using
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(saveId)) {
    console.warn('[queries] loadProgress: invalid saveId format');
    return null;
  }

  const { data, error } = await supabase
    .from('player_saves')
    .select('*')
    .eq('id', saveId)
    .single();

  if (error) { console.error('[queries] loadProgress failed', error.message); return null; }
  return data as SaveRow;
}

export async function postLeaderboardScore(
  player: PlayerData,
  extras: { bossKills: number; timePlayedS: number },
): Promise<void> {
  if (!supabase) return;

  const raw = {
    player_name:   player.name,
    total_damage:  player.totalDamage,
    max_combo:     player.maxCombo,
    boss_kills:    extras.bossKills,
    time_played_s: extras.timePlayedS,
  };

  const validated = validate(LeaderboardEntrySchema, raw);
  if (validated.error || !validated.data) {
    console.warn('[queries] postLeaderboardScore: validation failed —', validated.error);
    return;
  }

  const { error } = await supabase
    .from('leaderboard')
    .insert(validated.data);

  if (error) { console.error('[queries] postLeaderboardScore failed', error.message); }
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardRow[]> {
  if (!supabase) return [];

  // Clamp limit — prevent abuse
  const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 100);

  const { data, error } = await supabase
    .from('leaderboard')
    .select('player_name, total_damage, max_combo, boss_kills, created_at')
    .order('total_damage', { ascending: false })
    .limit(safeLimit);

  if (error) { console.error('[queries] getLeaderboard failed', error.message); return []; }
  return (data ?? []) as unknown as LeaderboardRow[];
}
