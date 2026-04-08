import Phaser from 'phaser';

// ── Reflection System ──────────────────────────────────────────────────────
// Pixel-art accurate reflections and directional shadows.
// Rules:
//   - Reflections snap to pixel grid — no sub-pixel smoothing
//   - Shadows are always region shadow colour — never black
//   - Reflections at 70% opacity — present, not distracting
//   - Moving water distorts reflection ±1px on 400ms cycle
//   - Unnamed City: no reflections until post-SisterSilence
//
// Usage:
//   const reflections = new ReflectionSystem(scene);
//   reflections.trackSprite(playerSprite, 'player');
//   reflections.setReflectionActive(true); // rain or water tile present
//   // In postupdate: reflections.update();

export interface ReflectedEntity {
  source:     Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite;
  shadow:     Phaser.GameObjects.Image;
  reflection: Phaser.GameObjects.Image | null;
  groundY:    number; // y position of shadow floor
}

export class ReflectionSystem {
  private _scene:        Phaser.Scene;
  private _entities:     Map<string, ReflectedEntity> = new Map();
  private _reflActive    = false;
  private _waterRipple   = 0; // oscillates ±1 for ripple distortion
  private _rippleTimer   = 0;
  private _frozen        = false; // winter ice — crisp, no ripple
  private _shadowColor:  number;
  private _shadowAlpha   = 0.35;

  // Unnamed City special state
  private _unnamedCityMode   = false;
  private _sisterSilenceKilled = false;
  private _revelationTriggered = false;

  constructor(scene: Phaser.Scene, shadowColor = 0x1F150E) {
    this._scene       = scene;
    this._shadowColor = shadowColor;
  }

  // ── Public ────────────────────────────────────────────────────────────

  trackSprite(
    source: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
    id: string,
    groundY?: number,
  ): void {
    const floorY = groundY ?? (source.y + (source.displayHeight / 2));

    // Shadow — always present
    const shadow = this._scene.add.image(source.x, floorY, source.texture.key)
      .setOrigin(0.5, 0)
      .setDisplaySize(source.displayWidth * 0.9, 4)
      .setTint(this._shadowColor)
      .setAlpha(this._shadowAlpha)
      .setDepth(source.depth - 1);

    // Reflection — only when active
    const reflection = this._reflActive ? this._makeReflection(source, floorY) : null;

    this._entities.set(id, { source, shadow, reflection, groundY: floorY });
  }

  untrackSprite(id: string): void {
    const entity = this._entities.get(id);
    if (!entity) return;
    entity.shadow.destroy();
    entity.reflection?.destroy();
    this._entities.delete(id);
  }

  setReflectionActive(active: boolean): void {
    if (active === this._reflActive) return;
    this._reflActive = active;

    if (active) {
      // Create reflections for all tracked entities
      this._entities.forEach((entity, id) => {
        if (!entity.reflection && !this._unnamedCityMode) {
          entity.reflection = this._makeReflection(entity.source, entity.groundY);
        }
        void id;
      });
    } else {
      // Remove all reflections
      this._entities.forEach(entity => {
        entity.reflection?.destroy();
        entity.reflection = null;
      });
    }
  }

  setFrozen(frozen: boolean): void {
    this._frozen = frozen; // winter — no ripple distortion
  }

  setRegion(region: string): void {
    this._unnamedCityMode = region === 'UNNAMED_CITY';
    if (this._unnamedCityMode && !this._sisterSilenceKilled) {
      // Kill reflections in Unnamed City
      this._entities.forEach(entity => {
        entity.reflection?.destroy();
        entity.reflection = null;
      });
    }
  }

  /** Call after SisterSilence is defeated. Triggers the reflection reveal. */
  onSisterSilenceKilled(): void {
    this._sisterSilenceKilled = true;
    if (this._unnamedCityMode && !this._revelationTriggered) {
      this._triggerRevelation();
    }
  }

  update(delta: number): void {
    // Water ripple oscillation
    if (!this._frozen) {
      this._rippleTimer += delta;
      if (this._rippleTimer >= 400) {
        this._rippleTimer -= 400;
        this._waterRipple = this._waterRipple === 0 ? 1 : 0;
      }
    }

    this._entities.forEach(entity => {
      const src = entity.source;
      const floorY = entity.groundY;

      // Update shadow — snap to pixel grid
      const shadowX = Math.round(src.x);
      entity.shadow.setPosition(shadowX, floorY);
      entity.shadow.setAlpha(src.alpha * this._shadowAlpha);

      // Update reflection
      if (entity.reflection) {
        const rx = Math.round(src.x) + (this._frozen ? 0 : this._waterRipple);
        const ry = floorY + 2;
        entity.reflection.setPosition(rx, ry);
        entity.reflection.setFlipY(true);
        entity.reflection.setAlpha(0.7 * src.alpha);
        entity.reflection.setScale(src.scaleX, src.scaleY);
        entity.reflection.setFrame(src.frame.name);
        entity.reflection.setDepth(entity.source.depth - 0.5);
      }
    });
  }

  destroy(): void {
    this._entities.forEach(entity => {
      entity.shadow.destroy();
      entity.reflection?.destroy();
    });
    this._entities.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────

  private _makeReflection(
    source: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
    groundY: number,
  ): Phaser.GameObjects.Image {
    const refl = this._scene.add.image(source.x, groundY, source.texture.key)
      .setOrigin(0.5, 0)
      .setFlipY(true)
      .setAlpha(0.7)
      .setDepth(source.depth - 0.5)
      .setTint(0xb0c8ff); // slight blue tint (water reflection)
    return refl;
  }

  private _triggerRevelation(): void {
    this._revelationTriggered = true;

    // Brief camera focus on player's feet — 2s automated
    this._scene.events.emit('revelation_reflection_start');

    // Gradually enable reflections
    this._scene.time.delayedCall(2000, () => {
      this._reflActive = true;
      this._entities.forEach(entity => {
        if (!entity.reflection) {
          entity.reflection = this._makeReflection(entity.source, entity.groundY);
          entity.reflection.setAlpha(0);
          this._scene.tweens.add({
            targets: entity.reflection, alpha: 0.7, duration: 1500,
          });
        }
      });
      this._scene.events.emit('revelation_reflection_complete');
    });
  }
}
