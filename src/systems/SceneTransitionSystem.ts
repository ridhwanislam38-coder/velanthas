import Phaser from 'phaser';
import { Bus, GameEvent } from './EventBus';
import { Audio } from './AudioSystem';

// ── SceneTransitionSystem ───────────────────────────────────────────────────
// Handles transitions between region scenes:
//   - Fade out (0.8s) → stop current scene → start target scene → fade in (0.8s)
//   - Emits REGION_EXIT before leaving, REGION_ENTER on arrival
//   - Crossfades ambient audio during transition
//   - Used by FastTravelSystem portals and region boundary triggers

const FADE_DURATION = 800;

export class SceneTransitionSystem {
  private _transitioning = false;

  get isTransitioning(): boolean { return this._transitioning; }

  /** Transition from current scene to target scene. */
  transition(
    currentScene: Phaser.Scene,
    targetSceneKey: string,
    targetData?: Record<string, unknown>,
  ): void {
    if (this._transitioning) return;
    this._transitioning = true;

    const cam = currentScene.cameras.main;

    // Emit exit event
    Bus.emit(GameEvent.REGION_EXIT, { scene: currentScene.scene.key });

    // Fade out
    cam.fadeOut(FADE_DURATION, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      // Stop audio during transition
      Audio.stopAll();

      // Switch scenes
      currentScene.scene.start(targetSceneKey, targetData);
      this._transitioning = false;
    });
  }

  /** Transition with a custom overlay color (e.g. white for Accord-related). */
  transitionWithColor(
    currentScene: Phaser.Scene,
    targetSceneKey: string,
    r: number, g: number, b: number,
    targetData?: Record<string, unknown>,
  ): void {
    if (this._transitioning) return;
    this._transitioning = true;

    const cam = currentScene.cameras.main;
    Bus.emit(GameEvent.REGION_EXIT, { scene: currentScene.scene.key });

    cam.fadeOut(FADE_DURATION, r, g, b);
    cam.once('camerafadeoutcomplete', () => {
      Audio.stopAll();
      currentScene.scene.start(targetSceneKey, targetData);
      this._transitioning = false;
    });
  }

  /** Void-cut transition for fast travel (longer + flash). */
  voidCutTransition(
    currentScene: Phaser.Scene,
    targetSceneKey: string,
    targetData?: Record<string, unknown>,
  ): void {
    if (this._transitioning) return;
    this._transitioning = true;

    const cam = currentScene.cameras.main;
    Bus.emit(GameEvent.REGION_EXIT, { scene: currentScene.scene.key });

    // Flash white, then fade to black
    cam.flash(200, 245, 240, 232); // Accord white
    currentScene.time.delayedCall(200, () => {
      cam.fadeOut(FADE_DURATION * 1.5, 0, 0, 0);
      cam.once('camerafadeoutcomplete', () => {
        Audio.stopAll();
        currentScene.scene.start(targetSceneKey, targetData);
        this._transitioning = false;
      });
    });
  }
}

export const Transitions = new SceneTransitionSystem();
