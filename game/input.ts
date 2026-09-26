export type Action =
  | "left"
  | "right"
  | "jump"
  | "down"
  | "attack"
  | "special"
  | "t1"
  | "t2"
  | "t3"
  | "t4"
  | "revert"
  | "pause"
  | "mute"
  | "start";

const KEYMAP: Record<string, Action[]> = {
  ArrowLeft: ["left"],
  KeyA: ["left"],
  ArrowRight: ["right"],
  KeyD: ["right"],
  ArrowUp: ["jump"],
  KeyW: ["jump"],
  Space: ["jump", "start"],
  ArrowDown: ["down"],
  KeyS: ["down"],
  KeyJ: ["attack"],
  KeyZ: ["attack"],
  KeyK: ["special"],
  KeyX: ["special"],
  Digit1: ["t1"],
  Digit2: ["t2"],
  Digit3: ["t3"],
  Digit4: ["t4"],
  Numpad1: ["t1"],
  Numpad2: ["t2"],
  Numpad3: ["t3"],
  Numpad4: ["t4"],
  KeyQ: ["revert"],
  KeyP: ["pause"],
  Escape: ["pause"],
  KeyM: ["mute"],
  Enter: ["start"],
};

/** Keyboard + touch input. `held` is continuous state, `pressed` is edge-triggered per sim step. */
export class Input {
  private held = new Set<Action>();
  private pressedSet = new Set<Action>();
  private target: Window | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    const actions = KEYMAP[e.code];
    if (!actions) return;
    e.preventDefault();
    if (e.repeat) return;
    actions.forEach((a) => this.press(a));
  };

  private onKeyUp = (e: KeyboardEvent) => {
    KEYMAP[e.code]?.forEach((a) => this.release(a));
  };

  private onBlur = () => this.held.clear();

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

  isHeld(a: Action) {
    return this.held.has(a);
  }

  wasPressed(a: Action) {
    return this.pressedSet.has(a);
  }

  clearPressed() {
    this.pressedSet.clear();
  }
}
