import Phaser from 'phaser';

// ── InputSystem — Keyboard + Gamepad, rebindable ────────────────────────────
// Abstracts all input behind named actions. Scenes use `Input.isDown(action)`
// instead of reading raw Phaser keys. Supports rebinding, auto-detection of
// active input source, and gamepad rumble.

// ── Actions ─────────────────────────────────────────────────────────────
export const enum InputAction {
  MOVE_UP     = 0,
  MOVE_DOWN   = 1,
  MOVE_LEFT   = 2,
  MOVE_RIGHT  = 3,
  ATTACK_LIGHT= 4,
  ATTACK_HEAVY= 5,
  DODGE       = 6,
  PARRY       = 7,
  INTERACT    = 8,
  SPECIAL_1   = 9,
  SPECIAL_2   = 10,
  SPECIAL_3   = 11,
  SPECIAL_4   = 12,
  SPECIAL_5   = 13,
  SPECIAL_6   = 14,
  SPECIAL_7   = 15,
  MENU        = 16,
  JOURNAL     = 17,
}

// ── Input source ────────────────────────────────────────────────────────
export type InputSource = 'keyboard' | 'gamepad';

// ── Binding shape ───────────────────────────────────────────────────────
interface ActionBinding {
  /** Phaser KeyCodes value */
  key: number;
  /** Gamepad button index (standard mapping: 0=A, 1=B, 2=X, 3=Y, etc.) */
  padButton: number;
}

// Gamepad standard button indices
const PAD = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9,
  L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
} as const;

const K = Phaser.Input.Keyboard.KeyCodes;

// ── Default bindings ────────────────────────────────────────────────────
const DEFAULTS: Record<InputAction, ActionBinding> = {
  [InputAction.MOVE_UP]:      { key: K.W,      padButton: PAD.UP },
  [InputAction.MOVE_DOWN]:    { key: K.S,      padButton: PAD.DOWN },
  [InputAction.MOVE_LEFT]:    { key: K.A,      padButton: PAD.LEFT },
  [InputAction.MOVE_RIGHT]:   { key: K.D,      padButton: PAD.RIGHT },
  [InputAction.ATTACK_LIGHT]: { key: K.J,      padButton: PAD.X },
  [InputAction.ATTACK_HEAVY]: { key: K.K,      padButton: PAD.Y },
  [InputAction.DODGE]:        { key: K.L,      padButton: PAD.B },
  [InputAction.PARRY]:        { key: K.Z,      padButton: PAD.LB },
  [InputAction.INTERACT]:     { key: K.E,      padButton: PAD.A },
  [InputAction.SPECIAL_1]:    { key: K.U,      padButton: PAD.RB },
  [InputAction.SPECIAL_2]:    { key: K.O,      padButton: PAD.RT },
  [InputAction.SPECIAL_3]:    { key: K.P,      padButton: PAD.LT },
  [InputAction.SPECIAL_4]:    { key: K.Q,      padButton: PAD.L3 },
  [InputAction.SPECIAL_5]:    { key: K.I,      padButton: PAD.R3 },
  [InputAction.SPECIAL_6]:    { key: K.ONE,    padButton: PAD.SELECT },
  [InputAction.SPECIAL_7]:    { key: K.TWO,    padButton: PAD.START },
  [InputAction.MENU]:         { key: K.ESC,    padButton: PAD.START },
  [InputAction.JOURNAL]:      { key: K.TAB,    padButton: PAD.SELECT },
};

// ── Left stick deadzone ─────────────────────────────────────────────────
const STICK_DEADZONE = 0.25;

// ── InputSystem ─────────────────────────────────────────────────────────
export class InputSystem {
  private _scene:    Phaser.Scene | null = null;
  private _bindings: Record<InputAction, ActionBinding> = { ...DEFAULTS };
  private _keys      = new Map<number, Phaser.Input.Keyboard.Key>();
  private _pad:      Phaser.Input.Gamepad.Gamepad | null = null;
  private _source:   InputSource = 'keyboard';
  private _prevSource: InputSource = 'keyboard';

  // Track "just pressed" for gamepad buttons manually (Phaser doesn't expose JustDown for pads)
  private _padPrev = new Set<number>();
  private _padCurr = new Set<number>();

  // ── Init — call once per scene ────────────────────────────────────────
  init(scene: Phaser.Scene): void {
    this._scene = scene;

    // Register all keyboard keys from bindings
    const kb = scene.input.keyboard;
    if (kb) {
      for (const action of Object.values(this._bindings) as ActionBinding[]) {
        if (!this._keys.has(action.key)) {
          this._keys.set(action.key, kb.addKey(action.key, true, false));
        }
      }
      // Also register arrow keys as movement alternates
      for (const code of [K.UP, K.DOWN, K.LEFT, K.RIGHT]) {
        if (!this._keys.has(code)) {
          this._keys.set(code, kb.addKey(code, true, false));
        }
      }
    }

    // Gamepad — grab first connected, or listen for connection
    if (scene.input.gamepad) {
      if (scene.input.gamepad.total > 0) {
        this._pad = scene.input.gamepad.pad1;
      }
      scene.input.gamepad.once('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
        this._pad = pad;
      });
    }
  }

  // ── Per-frame update — call from scene.update() ───────────────────────
  tick(): void {
    // Swap gamepad button buffers for "just pressed" detection
    const tmp = this._padPrev;
    this._padPrev = new Set(this._padCurr);
    this._padCurr = tmp;
    this._padCurr.clear();

    if (this._pad) {
      for (const btn of this._pad.buttons) {
        if (btn.pressed) this._padCurr.add(btn.index);
      }
    }

    // Detect source switch
    this._prevSource = this._source;
    if (this._anyKeyboardActivity()) {
      this._source = 'keyboard';
    } else if (this._anyGamepadActivity()) {
      this._source = 'gamepad';
    }
  }

  // ── Query actions ─────────────────────────────────────────────────────

  /** True while the action is held down. */
  isDown(action: InputAction): boolean {
    const b = this._bindings[action];

    // Keyboard
    const key = this._keys.get(b.key);
    if (key?.isDown) return true;

    // Arrow key alternates for movement
    if (action === InputAction.MOVE_UP    && this._keys.get(K.UP)?.isDown)    return true;
    if (action === InputAction.MOVE_DOWN  && this._keys.get(K.DOWN)?.isDown)  return true;
    if (action === InputAction.MOVE_LEFT  && this._keys.get(K.LEFT)?.isDown)  return true;
    if (action === InputAction.MOVE_RIGHT && this._keys.get(K.RIGHT)?.isDown) return true;

    // Gamepad button
    if (this._pad) {
      const btn = this._pad.buttons[b.padButton];
      if (btn?.pressed) return true;
    }

    // Left stick for movement
    if (this._pad) {
      const lx = this._pad.leftStick.x;
      const ly = this._pad.leftStick.y;
      if (action === InputAction.MOVE_UP    && ly < -STICK_DEADZONE) return true;
      if (action === InputAction.MOVE_DOWN  && ly >  STICK_DEADZONE) return true;
      if (action === InputAction.MOVE_LEFT  && lx < -STICK_DEADZONE) return true;
      if (action === InputAction.MOVE_RIGHT && lx >  STICK_DEADZONE) return true;
    }

    return false;
  }

  /** True only on the frame the action was first pressed. */
  justDown(action: InputAction): boolean {
    const b = this._bindings[action];

    // Keyboard
    const key = this._keys.get(b.key);
    if (key && Phaser.Input.Keyboard.JustDown(key)) return true;

    // Arrow alternates
    if (action === InputAction.MOVE_UP) {
      const k = this._keys.get(K.UP);
      if (k && Phaser.Input.Keyboard.JustDown(k)) return true;
    }
    if (action === InputAction.MOVE_DOWN) {
      const k = this._keys.get(K.DOWN);
      if (k && Phaser.Input.Keyboard.JustDown(k)) return true;
    }
    if (action === InputAction.MOVE_LEFT) {
      const k = this._keys.get(K.LEFT);
      if (k && Phaser.Input.Keyboard.JustDown(k)) return true;
    }
    if (action === InputAction.MOVE_RIGHT) {
      const k = this._keys.get(K.RIGHT);
      if (k && Phaser.Input.Keyboard.JustDown(k)) return true;
    }

    // Gamepad: pressed this frame but not last frame
    if (this._padCurr.has(b.padButton) && !this._padPrev.has(b.padButton)) {
      return true;
    }

    return false;
  }

  // ── Movement vector (normalised) ──────────────────────────────────────
  /** Returns {x, y} in -1..1 range, suitable for birds-eye 4/8-directional movement. */
  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.isDown(InputAction.MOVE_LEFT))  x -= 1;
    if (this.isDown(InputAction.MOVE_RIGHT)) x += 1;
    if (this.isDown(InputAction.MOVE_UP))    y -= 1;
    if (this.isDown(InputAction.MOVE_DOWN))  y += 1;

    // Gamepad analog stick override (takes priority if significant)
    if (this._pad) {
      const lx = this._pad.leftStick.x;
      const ly = this._pad.leftStick.y;
      if (Math.abs(lx) > STICK_DEADZONE || Math.abs(ly) > STICK_DEADZONE) {
        x = lx;
        y = ly;
      }
    }

    // Normalise diagonal
    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  // ── Input source ──────────────────────────────────────────────────────
  get source(): InputSource { return this._source; }
  get sourceChanged(): boolean { return this._source !== this._prevSource; }

  // ── Rumble ────────────────────────────────────────────────────────────
  /** Trigger gamepad vibration. No-op if no pad or pad lacks vibration. */
  rumble(durationMs: number, weakMagnitude = 0.5, strongMagnitude = 0.5): void {
    const gp = this._pad?.pad; // native Gamepad object
    if (!gp) return;
    const va = (gp as unknown as { vibrationActuator?: { playEffect: (type: string, params: unknown) => void } }).vibrationActuator;
    if (va) {
      va.playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude,
        strongMagnitude,
      });
    }
  }

  // ── Rebinding ─────────────────────────────────────────────────────────
  rebindKey(action: InputAction, keyCode: number): void {
    this._bindings[action] = { ...this._bindings[action], key: keyCode };
    // Register the new key
    if (this._scene?.input.keyboard && !this._keys.has(keyCode)) {
      this._keys.set(keyCode, this._scene.input.keyboard.addKey(keyCode, true, false));
    }
  }

  rebindPadButton(action: InputAction, buttonIndex: number): void {
    this._bindings[action] = { ...this._bindings[action], padButton: buttonIndex };
  }

  resetDefaults(): void {
    this._bindings = { ...DEFAULTS };
  }

  /** Serialise bindings for save persistence. */
  serialise(): Record<number, ActionBinding> {
    return { ...this._bindings };
  }

  /** Restore from saved bindings. */
  deserialise(saved: Record<number, ActionBinding>): void {
    for (const [k, v] of Object.entries(saved)) {
      const action = Number(k) as InputAction;
      if (v && typeof v.key === 'number' && typeof v.padButton === 'number') {
        this._bindings[action] = v;
      }
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private _anyKeyboardActivity(): boolean {
    for (const key of this._keys.values()) {
      if (key.isDown) return true;
    }
    return false;
  }

  private _anyGamepadActivity(): boolean {
    if (!this._pad) return false;
    for (const btn of this._pad.buttons) {
      if (btn.pressed) return true;
    }
    const lx = this._pad.leftStick.x;
    const ly = this._pad.leftStick.y;
    return Math.abs(lx) > STICK_DEADZONE || Math.abs(ly) > STICK_DEADZONE;
  }
}

/** Singleton — one InputSystem for the entire game session. */
export const Input = new InputSystem();
