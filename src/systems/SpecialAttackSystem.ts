import Phaser from 'phaser';
import type { CinematicSystem } from './CinematicSystem';
import { buildWorldWeightPanels } from './CinematicSystem';
import type { APSystem } from './APSystem';
import type { JuiceSystem } from './JuiceSystem';
import { Bus, GameEvent } from './EventBus';
import { CINEMATIC } from '../config/visualConfig';

// ── Special Attack System ──────────────────────────────────────────────────
// Defines and executes all 7 specials.
// Each special: AP cost, cinematic sequence, damage delivery.
// Damage is applied via Bus event — SpecialAttackSystem doesn't know about
// enemy internals.
//
// Usage:
//   const specials = new SpecialAttackSystem(scene, cinematic, ap, juice);
//   specials.use('JUDGMENT_MARK', playerX, playerY, targetSprites);

export type SpecialId =
  | 'JUDGMENT_MARK'
  | 'PHANTOM_STEP'
  | 'VOID_CRUCIBLE'
  | 'THORNWALL_REQUIEM'
  | 'THE_RECKONING'
  | 'SISTERS_ECHO'
  | 'WORLDS_WEIGHT';

export interface SpecialDef {
  id:       SpecialId;
  name:     string;
  apCost:   number;
  unlockCondition?: string;
  execute:  (ctx: SpecialCtx) => void;
}

export interface SpecialCtx {
  scene:   Phaser.Scene;
  cin:     CinematicSystem;
  ap:      APSystem;
  juice:   JuiceSystem;
  px:      number;
  py:      number;
  targets: Phaser.Physics.Arcade.Image[];
}

type FrameMs = number; // 1 frame @ 60fps ≈ 16.67ms
const F = (frames: number): FrameMs => frames * (1000 / 60);

export class SpecialAttackSystem {
  private _scene:  Phaser.Scene;
  private _cin:    CinematicSystem;
  private _ap:     APSystem;
  private _juice:  JuiceSystem;
  private _active  = false;
  private _unlocked: Set<SpecialId> = new Set(['JUDGMENT_MARK', 'PHANTOM_STEP', 'VOID_CRUCIBLE', 'THORNWALL_REQUIEM', 'THE_RECKONING']);

  private readonly _defs: Map<SpecialId, SpecialDef>;

  constructor(
    scene:  Phaser.Scene,
    cin:    CinematicSystem,
    ap:     APSystem,
    juice:  JuiceSystem,
  ) {
    this._scene = scene;
    this._cin   = cin;
    this._ap    = ap;
    this._juice = juice;
    this._defs  = this._buildDefs();
  }

  // ── Public ────────────────────────────────────────────────────────────

  use(id: SpecialId, px: number, py: number, targets: Phaser.Physics.Arcade.Image[]): boolean {
    if (this._active) return false;
    if (!this._unlocked.has(id)) return false;

    const def = this._defs.get(id);
    if (!def) return false;
    if (!this._ap.spend(def.apCost)) return false;

    this._active = true;
    this._cin.lockInput(300);
    Bus.emit(GameEvent.SPECIAL_START, { id });

    const ctx: SpecialCtx = {
      scene: this._scene, cin: this._cin, ap: this._ap, juice: this._juice,
      px, py, targets,
    };

    def.execute(ctx);

    return true;
  }

  unlock(id: SpecialId): void { this._unlocked.add(id); }
  isUnlocked(id: SpecialId): boolean { return this._unlocked.has(id); }

  get isActive(): boolean { return this._active; }

  private _end(id: SpecialId): void {
    this._active = false;
    Bus.emit(GameEvent.SPECIAL_END, { id });
  }

  // ── Special definitions ────────────────────────────────────────────────

  private _buildDefs(): Map<SpecialId, SpecialDef> {
    const defs = new Map<SpecialId, SpecialDef>();

    // ─── JUDGMENT MARK (1 AP) ───────────────────────────────────────────
    defs.set('JUDGMENT_MARK', {
      id: 'JUDGMENT_MARK', name: 'JUDGMENT MARK', apCost: 1,
      execute: (ctx) => {
        const { scene, cin, juice, targets } = ctx;
        // f01-f04: gather
        scene.time.delayedCall(F(4), () => {
          // f05-f08: SLAM — white flash + zoom in
          cin.colorFrame(0xFFFFFF, 2, 120);
          cin.cameraMove({ zoom: 1.4, duration: F(4), ease: 'Power3' });
          juice.flash(0xFFFFFF, 1.0, F(2));

          scene.time.delayedCall(F(8), () => {
            // f09-f12: shadow explosion AOE
            juice.shake(0.005, 200);

            targets.forEach(t => {
              Bus.emit(GameEvent.HIT_SPECIAL, { target: t, damage: 45, knockback: 120, hitstun: 24 });
            });

            scene.time.delayedCall(F(12), () => {
              cin.resetCamera(F(6));
              cin.showNameCard('JUDGMENT MARK');
              this._end('JUDGMENT_MARK');
            });
          });
        });
      },
    });

    // ─── PHANTOM STEP (1 AP) ────────────────────────────────────────────
    defs.set('PHANTOM_STEP', {
      id: 'PHANTOM_STEP', name: 'PHANTOM STEP', apCost: 1,
      execute: (ctx) => {
        const { scene, cin, juice, targets, px, py } = ctx;
        const { width } = scene.scale;

        // f01-f02: silhouette
        scene.time.delayedCall(F(2), () => {
          // f03-f04: streak across screen
          juice.flash(0x4488ff, 0.4, F(4));
          cin.cameraMove({ zoom: 1.1, duration: F(4), ease: 'Linear' });

          // Afterimages — 5 at stepped positions
          for (let i = 0; i < 5; i++) {
            const afterX = px + (width * (i / 5));
            const img = scene.add.rectangle(afterX, py, 8, 24, 0x6688aa, 0.6)
              .setDepth(200).setScrollFactor(1);
            scene.tweens.add({ targets: img, alpha: 0, duration: F(18), onComplete: () => img.destroy() });
          }

          scene.time.delayedCall(F(8), () => {
            // Single slash on first target — ignores block
            const t = targets[0];
            if (t) {
              Bus.emit(GameEvent.HIT_SPECIAL, { target: t, damage: 55, knockback: 100, hitstun: 24, ignoreBlock: true });
              juice.shake(0.004, 150);
            }

            scene.time.delayedCall(F(10), () => {
              cin.resetCamera(F(6));
              cin.showNameCard('PHANTOM STEP');
              this._end('PHANTOM_STEP');
            });
          });
        });
      },
    });

    // ─── VOID CRUCIBLE (2 AP) ────────────────────────────────────────────
    defs.set('VOID_CRUCIBLE', {
      id: 'VOID_CRUCIBLE', name: 'VOID CRUCIBLE', apCost: 2,
      execute: (ctx) => {
        const { scene, cin, juice, targets } = ctx;

        // f01-f10: hold phase — vignette darkens, purple glow
        cin.cameraMove({ zoom: 1.05, duration: F(10), ease: 'Power1' });
        juice.flash(0x7b2fff, 0.2, F(10));

        scene.time.delayedCall(F(10), () => {
          // f11-f12: full black
          cin.colorFrame(0x000000, 2, 0);

          scene.time.delayedCall(F(2), () => {
            // f13-f15: white void explosion
            cin.colorFrame(0xFFFFFF, 3, 300, () => {
              // Reveal: enemies with void cracks
              targets.forEach(t => {
                Bus.emit(GameEvent.HIT_SPECIAL, {
                  target: t, damage: 80, knockback: 100, hitstun: 30,
                  applyEffect: 'void_burn', effectDamage: 10, effectDuration: 4000,
                });
              });
              juice.shake(0.008, 400, 2);
            });

            scene.time.delayedCall(F(20), () => {
              cin.resetCamera(F(6));
              cin.showNameCard('VOID CRUCIBLE');
              this._end('VOID_CRUCIBLE');
            });
          });
        });
      },
    });

    // ─── THORNWALL REQUIEM (2 AP) ─────────────────────────────────────────
    defs.set('THORNWALL_REQUIEM', {
      id: 'THORNWALL_REQUIEM', name: 'THORNWALL REQUIEM', apCost: 2,
      execute: (ctx) => {
        const { scene, cin, juice, targets } = ctx;

        // f01-f06: slam hands — pull camera back
        cin.cameraMove({ zoom: 0.85, duration: F(6), ease: 'Power2' });

        scene.time.delayedCall(F(10), () => {
          // f11-f14: eruption — fill screen with vine particles
          const { width, height } = scene.scale;
          const vinePtcl = scene.add.particles(width / 2, height, '__DEFAULT', {
            x: { min: 0, max: width },
            y: height,
            speedY: { min: -600, max: -200 },
            speedX: { min: -50, max: 50 },
            lifespan: { min: 600, max: 1200 },
            scaleX: 0.2,
            scaleY: { min: 0.5, max: 2.0 },
            quantity: 12,
            tint: [0x2A5A20, 0x3A7A30, 0x4A9A40, 0xC84060],
            duration: F(8) * 1000,
          });
          vinePtcl.setScrollFactor(0).setDepth(250);

          // f15-f22: cathedral frame — hold
          scene.time.delayedCall(F(22), () => {
            // Apply to all enemies in range: root + bleed
            targets.forEach(t => {
              Bus.emit(GameEvent.HIT_SPECIAL, {
                target: t, damage: 70, knockback: 60, hitstun: 30,
                applyEffect: 'root', effectDuration: 2000,
              });
            });
            juice.shake(0.006, 300);

            scene.time.delayedCall(F(14), () => {
              vinePtcl.destroy();
              cin.resetCamera(F(8));
              cin.showNameCard('THORNWALL REQUIEM');
              this._end('THORNWALL_REQUIEM');
            });
          });
        });
      },
    });

    // ─── THE RECKONING (3 AP) ─────────────────────────────────────────────
    defs.set('THE_RECKONING', {
      id: 'THE_RECKONING', name: 'THE RECKONING', apCost: 3,
      execute: (ctx) => {
        const { scene, cin, juice, targets } = ctx;

        // f01-f03: TIME STOPS — desaturate all
        scene.physics.world.timeScale = 0.001;
        cin.desaturate(0, F(3));
        juice.flash(0xFFFFFF, 0.05, F(3));

        scene.time.delayedCall(F(6), () => {
          // f04-f06: camera pulls back — aerial
          cin.cameraMove({ zoom: 0.7, duration: F(6), ease: 'Power2' });
        });

        scene.time.delayedCall(F(10), () => {
          // f07-f10: light beam from sky — player weapon raises
          cin.cameraMove({ zoom: 1.0, duration: F(4), ease: 'Power3' });
        });

        scene.time.delayedCall(F(12), () => {
          // f11-f12: IMPACT FRAME — full white
          scene.physics.world.timeScale = 1;
          cin.colorFrame(0xFFFFFF, CINEMATIC.IMPACT_FRAME_HOLD, 400, () => {
            // All enemies stagger
            targets.forEach(t => {
              Bus.emit(GameEvent.HIT_SPECIAL, {
                target: t, damage: 120, knockback: 200, hitstun: 60,
                applyEffect: 'stagger', effectDuration: 3000,
                removeHealthBar: true,
              });
            });
          });

          scene.time.delayedCall(F(16), () => {
            // f19-f24: color snaps back — debris + region particles
            cin.desaturate(1, 0);
            juice.shake(0.008, 400, 2);

            scene.time.delayedCall(F(12), () => {
              cin.showNameCard('THE RECKONING');
              this._end('THE_RECKONING');
            });
          });
        });
      },
    });

    // ─── SISTER'S ECHO (3 AP) — requires ending A unlock ─────────────────
    defs.set('SISTERS_ECHO', {
      id: 'SISTERS_ECHO', name: '', apCost: 3, // No name card — just her symbol
      execute: (ctx) => {
        const { scene, cin, juice, targets } = ctx;

        // f01-f04: SisterSilence silhouette appears
        const { width, height } = scene.scale;
        const silhouette = scene.add.rectangle(width / 2, height / 2, 20, 40, 0xFFFFFF, 0.9)
          .setScrollFactor(0).setDepth(300).setAlpha(0);
        scene.tweens.add({ targets: silhouette, alpha: 0.9, duration: F(4) });

        scene.time.delayedCall(F(8), () => {
          // f09-f10: her face — close up (full white fade with her shape visible)
          cin.colorFrame(0xFFFFFF, 12, 0);
          silhouette.setAlpha(0);
        });

        scene.time.delayedCall(F(15), () => {
          // f11-f14: she walks toward enemy — streak
          juice.flash(0xFFFFFF, 0.8, F(4));

          scene.time.delayedCall(F(8), () => {
            // Impact — silence applied
            const t = targets[0];
            if (t) {
              Bus.emit(GameEvent.HIT_SPECIAL, {
                target: t, damage: 150, knockback: 0, hitstun: 120,
                applyEffect: 'silence', effectDuration: 8000,
                applyEffect2: 'marked', effectDuration2: 5000,
              });
            }

            scene.time.delayedCall(F(8), () => {
              // Dissolves into petals
              const petals = scene.add.particles(width / 2, height / 2, '__DEFAULT', {
                x: { min: -60, max: 60 }, y: { min: -40, max: 40 },
                speedX: { min: -40, max: 40 }, speedY: { min: -80, max: -20 },
                lifespan: 1500, quantity: 20, tint: 0xFFFFFF,
                scaleX: 0.3, scaleY: 0.3,
              });
              petals.setScrollFactor(0).setDepth(301);
              silhouette.destroy();

              scene.time.delayedCall(1200, () => {
                petals.destroy();
                // Show symbol instead of name card
                const symbol = scene.add.text(width / 2, height - 16, '○', {
                  fontFamily: "'Press Start 2P'", fontSize: '8px', color: '#FFFFFF',
                }).setOrigin(0.5).setScrollFactor(0).setDepth(400).setAlpha(0);
                scene.tweens.add({
                  targets: symbol, alpha: 1, duration: 400, yoyo: true, hold: 800,
                  onComplete: () => symbol.destroy(),
                });
                this._end('SISTERS_ECHO');
              });
            });
          });
        });
      },
    });

    // ─── WORLD'S WEIGHT (3 AP) ────────────────────────────────────────────
    defs.set('WORLDS_WEIGHT', {
      id: 'WORLDS_WEIGHT', name: "WORLD'S WEIGHT", apCost: 3,
      execute: (ctx) => {
        const { scene, cin, juice, targets } = ctx;
        const { width, height } = scene.scale;

        // f01-f30: charge — cycle region glows
        let cycleIdx = 0;
        const regionColors = [0x3D2B1F, 0x1C3A2A, 0x2A2E38, 0x3D2E0A, 0x1A0A2E];
        const colorCycle = scene.time.addEvent({
          delay: F(6), repeat: 4,
          callback: () => {
            juice.flash(regionColors[cycleIdx % regionColors.length], 0.15, F(6));
            cycleIdx++;
          },
        });

        scene.time.delayedCall(F(30), () => {
          colorCycle.remove();

          // f31-f34: 5-panel split
          const panels = buildWorldWeightPanels(width, height);
          cin.showPanels(panels, F(4) * 1000, () => {
            // f35-f36: panels collapse to weapon dot
            cin.colorFrame(0xFFFFFF, 2, 0);

            scene.time.delayedCall(F(2), () => {
              // f37-f38: white fills screen
              cin.colorFrame(0xFFFFFF, 12, 800, () => {
                // Apply to all targets — 5 waves
                targets.forEach(t => {
                  for (let wave = 0; wave < 5; wave++) {
                    scene.time.delayedCall(wave * 80, () => {
                      Bus.emit(GameEvent.HIT_SPECIAL, {
                        target: t, damage: 20, knockback: 30, hitstun: 10,
                        regionWave: wave,
                      });
                    });
                  }
                });

                scene.time.delayedCall(F(10), () => {
                  juice.shake(0.008, 500, 2);
                  cin.showNameCard("WORLD'S WEIGHT");
                  this._end('WORLDS_WEIGHT');
                });
              });
            });
          });
        });
      },
    });

    return defs;
  }
}
