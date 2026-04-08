import Phaser from 'phaser';
import { Bus, GameEvent } from './EventBus';

// ── Sight System ───────────────────────────────────────────────────────────
// Enemy sight types:
//   CONE_SIGHT      — soldiers, guards (gradual detection ramp)
//   RADIUS_SIGHT    — Voidborn, WailingSister (instant 360°)
//   SOUND_SIGHT     — TheSleepwalker, BoneLurker (footstep/impact detection)
//   MEMORY_SIGHT    — EchoSelf, SisterSilence (always knows where you are)
//
// Player modifiers:
//   darkness: -60% detection range for CONE_SIGHT
//   tall grass: invisible to CONE_SIGHT while crouching
//   STP 20: removes footstep sound (negates SOUND_SIGHT partially)

export type SightType = 'CONE_SIGHT' | 'RADIUS_SIGHT' | 'SOUND_SIGHT' | 'MEMORY_SIGHT';
export type DetectionState = 'IDLE' | 'YELLOW' | 'ORANGE' | 'RED' | 'LOST';

export interface SightConfig {
  type:          SightType;
  coneRange?:    number;   // px — CONE_SIGHT primary
  coneAngle?:    number;   // degrees — CONE_SIGHT primary (default 90)
  periRange?:    number;   // px — CONE_SIGHT peripheral
  periAngle?:    number;   // degrees — CONE_SIGHT peripheral (default 180)
  radius?:       number;   // px — RADIUS_SIGHT
  soundRange?:   { footstep: number; attack: number; land: number }; // px
}

export class SightComponent {
  private _scene:     Phaser.Scene;
  private _entity:    Phaser.GameObjects.GameObject & {
    x: number; y: number; flipX: boolean;
  };
  private _config:    SightConfig;
  private _state:     DetectionState = 'IDLE';
  private _stateTimer = 0;
  private _indicator!: Phaser.GameObjects.Arc;

  // Sight cone debug graphics (dev only)
  private _debug:  Phaser.GameObjects.Graphics | null = null;

  // Modifiers applied from player state
  private _inDarkness     = false;
  private _inTallGrass    = false;
  private _playerCrouching = false;
  private _silentMove     = false; // STP 20 attribute

  constructor(
    scene: Phaser.Scene,
    entity: Phaser.GameObjects.GameObject & { x: number; y: number; flipX: boolean },
    config: SightConfig,
  ) {
    this._scene  = scene;
    this._entity = entity;
    this._config = config;
    this._buildIndicator();
  }

  // ── Public ────────────────────────────────────────────────────────────

  checkPlayer(playerX: number, playerY: number): DetectionState {
    if (this._config.type === 'MEMORY_SIGHT') {
      return this._setDetection('RED');
    }

    const detected = this._isPlayerDetected(playerX, playerY);

    switch (this._config.type) {
      case 'CONE_SIGHT': {
        if (detected) {
          // Ramp up: IDLE → YELLOW → ORANGE → RED
          this._stateTimer += 16; // ~1 frame at 60fps
          if      (this._state === 'IDLE'   && this._stateTimer > 600)  this._setDetection('YELLOW');
          else if (this._state === 'YELLOW' && this._stateTimer > 1200) this._setDetection('ORANGE');
          else if (this._state === 'ORANGE' && this._stateTimer > 1800) this._setDetection('RED');
        } else {
          // Ramp down: RED stays unless out of sight 1.5s
          if (this._state !== 'IDLE') {
            this._stateTimer -= 32;
            if (this._stateTimer <= 0) {
              this._stateTimer = 0;
              this._setDetection(this._state === 'RED' ? 'LOST' : 'IDLE');
            }
          }
        }
        break;
      }

      case 'RADIUS_SIGHT':
        this._setDetection(detected ? 'RED' : 'IDLE');
        break;

      case 'SOUND_SIGHT':
        // Handled via events — not by position polling
        break;
    }

    this._updateIndicator();
    return this._state;
  }

  /** Set context modifiers from world state. */
  setContext(opts: {
    inDarkness?: boolean;
    inTallGrass?: boolean;
    playerCrouching?: boolean;
    silentMove?: boolean;
  }): void {
    if (opts.inDarkness    !== undefined) this._inDarkness     = opts.inDarkness;
    if (opts.inTallGrass   !== undefined) this._inTallGrass    = opts.inTallGrass;
    if (opts.playerCrouching !== undefined) this._playerCrouching = opts.playerCrouching;
    if (opts.silentMove    !== undefined) this._silentMove     = opts.silentMove;
  }

  get detectionState(): DetectionState { return this._state; }

  destroy(): void {
    this._indicator.destroy();
    this._debug?.destroy();
  }

  // ── Detection logic ────────────────────────────────────────────────────

  private _isPlayerDetected(px: number, py: number): boolean {
    const ex = this._entity.x;
    const ey = this._entity.y;
    const dx = px - ex;
    const dy = py - ey;
    const dist = Math.sqrt(dx * dx + dy * dy);

    switch (this._config.type) {
      case 'CONE_SIGHT': {
        const cfg = this._config;
        let range = (cfg.coneRange ?? 120) * (this._inDarkness ? 0.4 : 1.0);

        // Tall grass check
        if (this._inTallGrass && this._playerCrouching) return false;

        // Primary cone
        if (dist <= range) {
          const angle    = Math.atan2(dy, dx) * Phaser.Math.RAD_TO_DEG;
          const facing   = this._entity.flipX ? 180 : 0;
          const halfAngle = (cfg.coneAngle ?? 90) / 2;
          const diff     = Phaser.Math.Angle.ShortestBetween(angle, facing);
          if (Math.abs(diff) <= halfAngle) return true;
        }

        // Peripheral (detects movement only — simulated by shorter range)
        const periRange = (cfg.periRange ?? 40) * (this._inDarkness ? 0.4 : 1.0);
        if (dist <= periRange) return true;

        return false;
      }

      case 'RADIUS_SIGHT': {
        const r = this._config.radius ?? 120;
        return dist <= r;
      }

      default:
        return false;
    }
  }

  private _setDetection(state: DetectionState): DetectionState {
    if (state === this._state) return this._state;
    const prev = this._state;
    this._state = state;

    const events: Partial<Record<DetectionState, GameEvent>> = {
      YELLOW: GameEvent.ENEMY_DETECT_YELLOW,
      ORANGE: GameEvent.ENEMY_DETECT_ORANGE,
      RED:    GameEvent.ENEMY_DETECT_RED,
      LOST:   GameEvent.ENEMY_LOST_SIGHT,
    };

    const ev = events[state];
    if (ev) Bus.emit(ev, { entity: this._entity, prev });

    return this._state;
  }

  // ── Indicator ─────────────────────────────────────────────────────────

  private _buildIndicator(): void {
    this._indicator = this._scene.add.arc(0, 0, 3, 0, 360, false, 0xffff00, 1)
      .setScrollFactor(1)
      .setDepth(300)
      .setVisible(false);
  }

  private _updateIndicator(): void {
    const ex = this._entity.x;
    const ey = this._entity.y;
    const offsetY = -20;

    switch (this._state) {
      case 'IDLE':
      case 'LOST':
        this._indicator.setVisible(false);
        return;
      case 'YELLOW':
        this._indicator.setVisible(true).setPosition(ex, ey + offsetY).setFillStyle(0xffff00, 0.6);
        return;
      case 'ORANGE':
        this._indicator.setVisible(true).setPosition(ex, ey + offsetY).setFillStyle(0xff8800, 0.8);
        return;
      case 'RED':
        this._indicator.setVisible(true).setPosition(ex, ey + offsetY).setFillStyle(0xff0000, 1.0);
        return;
    }
  }
}

// ── Sound Sight event listener ─────────────────────────────────────────────
// Systems that need SOUND_SIGHT enemies emit sound events via Bus.
// SightSystem provides this standalone helper to wire those up.

export function makeSoundDetector(opts: {
  scene:       Phaser.Scene;
  entity:      Phaser.GameObjects.GameObject & { x: number; y: number; flipX: boolean };
  ranges:      { footstep: number; attack: number; land: number };
  onDetect:    () => void;
  silentMove?: () => boolean;
}): () => void {
  const { scene, entity, ranges, onDetect, silentMove } = opts;

  const check = (sourceX: number, sourceY: number, threshold: number) => {
    const dx   = sourceX - entity.x;
    const dy   = sourceY - entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= threshold) onDetect();
  };

  // Footstep check — simulated by player x,y regularly
  const footstepInterval = scene.time.addEvent({
    delay: 300,
    loop:  true,
    callback: () => {
      if (silentMove?.()) return;
      // Player position pulled from scene registry
      const player = (scene as Phaser.Scene & { _playerX?: number; _playerY?: number });
      if (player._playerX !== undefined) {
        check(player._playerX, player._playerY ?? 0, ranges.footstep);
      }
    },
  });

  // Impact events
  const landHandler = (data: unknown) => {
    const d = data as { x: number; y: number };
    check(d.x, d.y, ranges.land);
  };
  Bus.on(GameEvent.PLAYER_LAND, landHandler);

  // Return cleanup function
  return () => {
    footstepInterval.remove();
    Bus.off(GameEvent.PLAYER_LAND, landHandler);
  };
}
