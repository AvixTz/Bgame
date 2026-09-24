/**
 * Shared movement input, written by the keyboard and the on-screen joystick and read every frame.
 *
 * Every source must be able to go back to zero on its own. A value that only resets on "pointerup" or
 * "keyup" gets stuck when that event is lost (element unmounted mid-drag, focus change, tab switch),
 * and the avatar keeps walking with nothing pressed. So the joystick is released by its own
 * pointerup/cancel/lost-capture, by a window-level pointerup for the same pointer, and by
 * `resetInput()` on blur, tab hide, world pause and joystick unmount.
 */
export const input = {
  keys: new Set<string>(),
  joy: { x: 0, z: 0, active: false, pointerId: -1 },
};

const DEADZONE = 0.18;

const KEYMAP: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

export function keyVector(): [number, number] {
  let x = 0, z = 0;
  for (const k of input.keys) {
    const v = KEYMAP[k];
    if (v) { x += v[0]; z += v[1]; }
  }
  return [x, z];
}

/** Joystick vector with a dead zone and a smooth ramp outside it. Zero when the stick is not held. */
export function joystickVector(): [number, number] {
  const j = input.joy;
  if (!j.active) return [0, 0];
  const mag = Math.hypot(j.x, j.z);
  if (mag < DEADZONE) return [0, 0];
  const scaled = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE));
  return [(j.x / mag) * scaled, (j.z / mag) * scaled];
}

/** Combined movement intent, length ≤ 1. */
export function moveVector(): [number, number] {
  const [kx, kz] = keyVector();
  const [jx, jz] = joystickVector();
  let x = kx + jx, z = kz + jz;
  const len = Math.hypot(x, z);
  if (len > 1) { x /= len; z /= len; }
  return [x, z];
}

export function setJoystick(x: number, z: number, pointerId: number) {
  input.joy.x = x;
  input.joy.z = z;
  input.joy.active = true;
  input.joy.pointerId = pointerId;
}

export function releaseJoystick() {
  input.joy.x = 0;
  input.joy.z = 0;
  input.joy.active = false;
  input.joy.pointerId = -1;
}

export function resetInput() {
  input.keys.clear();
  releaseJoystick();
}

export function bindKeyboard(onEnter: () => void) {
  const down = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (KEYMAP[e.code]) { input.keys.add(e.code); e.preventDefault(); }
    if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) { e.preventDefault(); onEnter(); }
  };
  const up = (e: KeyboardEvent) => input.keys.delete(e.code);
  // A pointer released anywhere ends the joystick drag, even if the joystick element is gone.
  const pointerEnd = (e: PointerEvent) => { if (e.pointerId === input.joy.pointerId) releaseJoystick(); };
  const hidden = () => { if (document.visibilityState !== 'visible') resetInput(); };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', resetInput);
  window.addEventListener('pointerup', pointerEnd);
  window.addEventListener('pointercancel', pointerEnd);
  document.addEventListener('visibilitychange', hidden);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', resetInput);
    window.removeEventListener('pointerup', pointerEnd);
    window.removeEventListener('pointercancel', pointerEnd);
    document.removeEventListener('visibilitychange', hidden);
    resetInput();
  };
}
