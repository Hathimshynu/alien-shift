import type { Action, InputSource, MoveVector, TransformAction } from "./core/types";

export type { Action } from "./core/types";

const KEYMAP: Record<string, Action[]> = {
  ArrowLeft: ["left"],
  KeyA: ["left"],
  ArrowRight: ["right"],
  KeyD: ["right"],
  ArrowUp: ["up"],
  KeyW: ["up"],
  ArrowDown: ["down"],
  KeyS: ["down"],
  Space: ["jump", "start"],
  KeyC: ["drop"],
  KeyJ: ["attack"],
  KeyZ: ["attack"],
  KeyK: ["special"],
  KeyX: ["special"],
  KeyL: ["ultimate"],
  ShiftLeft: ["dodge"],
  ShiftRight: ["dodge"],
  Tab: ["wheel"],
  KeyQ: ["revert"],
  KeyP: ["pause"],
  Escape: ["pause"],
  KeyM: ["mute"],
  Enter: ["start"],
};

// Keys 1–9 and 0 pick the ten aliens directly (top row and numpad).
for (let i = 1; i <= 10; i++) {
  const digit = i % 10;
  const action = `t${i}` as TransformAction;
  KEYMAP[`Digit${digit}`] = [action];
  KEYMAP[`Numpad${digit}`] = [action];
}

/**
 * Keyboard + touch input. `held` is continuous state; `pressed` is edge-triggered and must be
 * cleared after each simulation step (see `clearPressed`) so one tap is seen by exactly one step.
 */
export class Input implements InputSource {
  private held = new Set<Action>();
  private pressedSet = new Set<Action>();
  private target: Window | null = null;
  /** Analog stick from the touch joystick (screen space: +y is down = towards the camera). */
  private stick: MoveVector = { x: 0, z: 0 };
  private moveOut: MoveVector = { x: 0, z: 0 };

  private onKeyDown = (e: KeyboardEvent) => {
    const actions = KEYMAP[e.code];
    if (!actions) return;
    e.preventDefault();
    if (e.repeat) {
      // Auto-repeat of a key that is physically still down (e.g. after `releaseAll` on pause):
      // restore the held state without faking a new press.
      actions.forEach((a) => this.held.add(a));
      return;
    }
    actions.forEach((a) => this.press(a));
  };

  private onKeyUp = (e: KeyboardEvent) => {
    KEYMAP[e.code]?.forEach((a) => this.release(a));
  };

  private onBlur = () => this.releaseAll();

  attach(target: Window) {
    this.target = target;
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  detach() {
    this.target?.removeEventListener("keydown", this.onKeyDown);
    this.target?.removeEventListener("keyup", this.onKeyUp);
    this.target?.removeEventListener("blur", this.onBlur);
    this.target = null;
  }

  press(a: Action) {
    if (!this.held.has(a)) this.pressedSet.add(a);
    this.held.add(a);
  }

  release(a: Action) {
    this.held.delete(a);
  }

  /** Set the touch joystick vector (each axis -1..1); pass 0,0 when the finger lifts. */
  setStick(x: number, z: number) {
    this.stick.x = x;
    this.stick.z = z;
  }

  /**
   * Forget every held/pressed action. Called whenever the game status changes: on-screen touch
   * buttons unmount mid-press and never get their pointerup, which used to leave actions stuck
   * "held" (a dead pause button, auto-attacking after a restart).
   */
  releaseAll() {
    this.held.clear();
    this.pressedSet.clear();
    this.setStick(0, 0);
  }

  isHeld(a: Action) {
    return this.held.has(a);
  }

  wasPressed(a: Action) {
    return this.pressedSet.has(a);
  }

  /** Keyboard direction (normalised so diagonals aren't faster) or the joystick, whichever is stronger. */
  move(): MoveVector {
    let x = (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
    let z = (this.held.has("down") ? 1 : 0) - (this.held.has("up") ? 1 : 0);
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    if (Math.hypot(this.stick.x, this.stick.z) > len) {
      x = this.stick.x;
      z = this.stick.z;
    }
    this.moveOut.x = x;
    this.moveOut.z = z;
    return this.moveOut;
  }

  /** Read-and-clear a single edge press (for actions handled outside the fixed-step sim, like mute). */
  consume(a: Action) {
    return this.pressedSet.delete(a);
  }

  clearPressed() {
    this.pressedSet.clear();
  }
}
