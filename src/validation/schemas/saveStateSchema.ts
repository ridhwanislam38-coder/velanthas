import { z } from 'zod';

// ── Save state validation ──────────────────────────────────────────────────
// Validates all data before it reaches Supabase.
// Strip unknown fields. Enforce min/max on every number and string.

const noHtml  = (val: string) => !/<[^>]*>/.test(val);
const noNulls = (val: string) => !val.includes('\0');
const safeStr = z.string().trim().refine(noHtml, 'HTML not allowed').refine(noNulls, 'Null bytes not allowed');

export const PlayerSaveSchema = z.object({
  region:     safeStr.max(50),
  position_x: z.number().finite().min(-100_000).max(100_000),
  position_y: z.number().finite().min(-100_000).max(100_000),
  hp:         z.number().int().min(0).max(99_999),
  max_hp:     z.number().int().min(1).max(99_999),
  ap:         z.number().int().min(0).max(3),

  // Attributes: arbitrary key→number map, bounded
  attributes: z.record(safeStr.max(30), z.number().finite().min(0).max(999)).optional(),

  // Pictos: array of string IDs
  pictos: z.array(safeStr.max(50)).max(50).optional(),

  // Equipment slots
  equipment: z.object({
    weapon:  safeStr.max(50).nullable().optional(),
    offhand: safeStr.max(50).nullable().optional(),
    armor:   safeStr.max(50).nullable().optional(),
    charm:   safeStr.max(50).nullable().optional(),
  }).optional(),
}).strict(); // reject unknown fields

export type PlayerSave = z.infer<typeof PlayerSaveSchema>;

export const QuestStateSchema = z.object({
  quest_id:     safeStr.max(100),
  stage:        z.number().int().min(0).max(99),
  choices_made: z.record(safeStr.max(50), z.union([z.string().max(100), z.number(), z.boolean()])).optional(),
}).strict();

export type QuestState = z.infer<typeof QuestStateSchema>;

export const FactionRepSchema = z.object({
  faction_id: z.enum(['IRONVEIL', 'THEWILD', 'VOIDBORN', 'GILDED', 'FORGOTTEN', 'SILENTONES', 'NEUTRAL']),
  rep_value:  z.number().int().min(-100).max(100),
}).strict();

export type FactionRep = z.infer<typeof FactionRepSchema>;

export const BossDeathSchema = z.object({
  boss_id:     safeStr.max(100),
  death_count: z.number().int().min(0).max(9999),
}).strict();

export type BossDeath = z.infer<typeof BossDeathSchema>;
