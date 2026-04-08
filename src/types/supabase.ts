// ── Supabase database row types ────────────────────────────────────────────

export interface SaveRow {
  id: string;
  user_id: string;
  player_name: string;
  level: number;
  xp: number;
  gold: number;
  hp: number;
  max_hp: number;
  atk: number;
  subjects_unlocked: string[];
  questions_answered: number;
  total_damage: number;
  max_combo: number;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardRow {
  id: string;
  user_id: string;
  player_name: string;
  total_damage: number;
  max_combo: number;
  level_reached: number;
  created_at: string;
}
