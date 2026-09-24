/** Shared input state written by keyboard and on-screen joystick, read every frame by the player. */
export const input = { x: 0, z: 0, keys: new Set<string>() };

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

export function bindKeyboard(onEnter: () => void) {
  const down = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (KEYMAP[e.code]) { input.keys.add(e.code); e.preventDefault(); }
    if (e.code === 'Enter' || e.code === 'Space') onEnter();
  };
  const up = (e: KeyboardEvent) => input.keys.delete(e.code);
  const blur = () => input.keys.clear();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    input.keys.clear();
  };
}
