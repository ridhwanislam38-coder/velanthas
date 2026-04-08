import Phaser from 'phaser';
import type { Season, TimeOfDay } from '../config/worldConfig';
import { DAY_CYCLE, SEASON_CYCLE, SPAWN_MULTIPLIERS } from '../config/worldConfig';

// ── Season & Day System ────────────────────────────────────────────────────
// One persistent clock drives both time-of-day and season.
// All timing in real milliseconds.

const DAY_MS     = DAY_CYCLE.TOTAL_MINUTES * 60_000;
const SEASON_MS  = SEASON_CYCLE.HOURS_PER_SEASON * 3_600_000;

// Time-of-day phase boundaries (ms into the day)
const DAWN_END  = DAY_CYCLE.DAWN_MINUTES  * 60_000;
const DAY_END   = DAWN_END + DAY_CYCLE.DAY_MINUTES * 60_000;
const DUSK_END  = DAY_END  + DAY_CYCLE.DUSK_MINUTES * 60_000;
// NIGHT_END = DAY_MS

export class SeasonSystem {
  private _scene:        Phaser.Scene;
  private _elapsed:      number;   // ms into current day
  private _seasonElapsed: number;  // ms into current season
  private _seasonIdx:    number;   // 0-3
  private _timeOfDay:    TimeOfDay;
  private _season:       Season;

  // Listeners
  private _todListeners:    Array<(tod: TimeOfDay) => void> = [];
  private _seasonListeners: Array<(s: Season) => void>      = [];

  constructor(scene: Phaser.Scene) {
    this._scene          = scene;
    this._elapsed        = 0;
    this._seasonElapsed  = 0;
    this._seasonIdx      = 0;
    this._timeOfDay      = 'dawn';
    this._season         = 'spring';
  }

  // ── Public ────────────────────────────────────────────────────────────

  update(delta: number): void {
    const prevTod    = this._timeOfDay;
    const prevSeason = this._season;

    // Advance day clock
    this._elapsed = (this._elapsed + delta) % DAY_MS;
    this._timeOfDay = this._calcTimeOfDay();

    // Advance season clock
    this._seasonElapsed += delta;
    if (this._seasonElapsed >= SEASON_MS) {
      this._seasonElapsed -= SEASON_MS;
      this._seasonIdx = (this._seasonIdx + 1) % 4;
      this._season = SEASON_CYCLE.SEASONS[this._seasonIdx] ?? 'spring';
    }

    // Notify on change
    if (this._timeOfDay !== prevTod) {
      this._todListeners.forEach(fn => fn(this._timeOfDay));
      this._scene.events.emit('time_of_day_change', this._timeOfDay);
    }
    if (this._season !== prevSeason) {
      this._seasonListeners.forEach(fn => fn(this._season));
      this._scene.events.emit('season_change', this._season);
    }
  }

  onTimeOfDayChange(fn: (tod: TimeOfDay) => void): void {
    this._todListeners.push(fn);
  }

  onSeasonChange(fn: (s: Season) => void): void {
    this._seasonListeners.push(fn);
  }

  get timeOfDay(): TimeOfDay { return this._timeOfDay; }
  get season():    Season    { return this._season;    }

  /** 0-1 progress through current day phase */
  get phaseProgress(): number {
    const [start, end] = this._phaseBounds();
    return (this._elapsed - start) / (end - start);
  }

  /** Combined enemy stat modifiers for current time */
  get enemyMods(): { dmg: number; spd: number } {
    return SPAWN_MULTIPLIERS[this._timeOfDay];
  }

  /** Ambient light alpha modifier (0 = fully lit, 1 = fully dark) */
  get ambientDarkness(): number {
    switch (this._timeOfDay) {
      case 'dawn':  return 0.3;
      case 'day':   return 0.0;
      case 'dusk':  return 0.3;
      case 'night': return 0.7;
    }
  }

  /** Whether stars should be visible */
  get starsVisible(): boolean {
    return this._timeOfDay === 'night' || this._timeOfDay === 'dawn';
  }

  /** Season-specific particle visibility flags */
  get seasonFlags(): Readonly<{
    autumnLeaves: boolean;
    springFlowers: boolean;
    winterSnow: boolean;
    summerPollen: boolean;
    summerHeatShimmer: boolean;
  }> {
    return {
      autumnLeaves:       this._season === 'autumn',
      springFlowers:      this._season === 'spring',
      winterSnow:         this._season === 'winter',
      summerPollen:       this._season === 'summer',
      summerHeatShimmer:  this._season === 'summer',
    };
  }

  // ── Private ───────────────────────────────────────────────────────────

  private _calcTimeOfDay(): TimeOfDay {
    if (this._elapsed < DAWN_END)  return 'dawn';
    if (this._elapsed < DAY_END)   return 'day';
    if (this._elapsed < DUSK_END)  return 'dusk';
    return 'night';
  }

  private _phaseBounds(): [number, number] {
    switch (this._timeOfDay) {
      case 'dawn':  return [0, DAWN_END];
      case 'day':   return [DAWN_END, DAY_END];
      case 'dusk':  return [DAY_END, DUSK_END];
      case 'night': return [DUSK_END, DAY_MS];
    }
  }
}
