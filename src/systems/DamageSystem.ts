import { DAMAGE, LEVEL } from '../config/Balance';
import type { PlayerData, BuffState } from '../types/game';

interface DamageResult {
  amount: number;
  isCrit: boolean;
  isBreak: boolean;
  formatted: string;
}

// Step 5: E33-style exponential damage formula
export class DamageSystem {
  // TODO (Step 5): Implement calculate(), awardXP(), formatNumber()

  static calculate(
    _player: PlayerData,
    _timerPct: number,   // 0–1, higher = faster answer
    _buffs: BuffState,
  ): DamageResult {
    throw new Error('DamageSystem.calculate() not yet implemented');
  }

  static awardXP(_player: PlayerData, _xp: number): { leveled: boolean; newLevel: number } {
    throw new Error('DamageSystem.awardXP() not yet implemented');
  }

  static formatNumber(n: number): string {
    if (n < 1_000)         return String(Math.floor(n));
    if (n < 1_000_000)     return `${(n / 1_000).toFixed(1)}K`;
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n < 1e12)          return `${(n / 1_000_000_000).toFixed(1)}B`;
    return `${(n / 1e12).toFixed(1)}T`;
  }
}

// Silence unused import warnings until implementation is written
void DAMAGE; void LEVEL;
