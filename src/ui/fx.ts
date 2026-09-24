import confetti from 'canvas-confetti';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#2E6BFF', '#FFB930', '#FF4F8B', '#1FC690', '#8A5CF6'];

/** Small burst from a point (0..1 screen coords) - a correct answer. */
export function burst(x = 0.5, y = 0.55) {
  if (reduced()) return;
  void confetti({ particleCount: 36, spread: 60, startVelocity: 32, gravity: 1.1, ticks: 120, scalar: 0.9, origin: { x, y }, colors: COLORS, disableForReducedMotion: true });
}

/** Big two-sided celebration - mastery, journey complete, a win. */
export function celebrate() {
  if (reduced()) return;
  const opts = { particleCount: 70, spread: 70, startVelocity: 48, ticks: 200, colors: COLORS, disableForReducedMotion: true };
  void confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.75 } });
  void confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.75 } });
}
