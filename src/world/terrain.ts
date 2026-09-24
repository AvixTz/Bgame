import { PORTALS, portalPos } from './portals';

/** Island radius (grass edge). The beach ring extends ~3 units beyond. */
export const ISLAND_R = 21;

const PORTAL_POS = PORTALS.map((p) => portalPos(p));

/** Distance from point to the segment origin→portal (the stone paths). */
function distToPath(x: number, z: number): number {
  let best = Infinity;
  for (const p of PORTAL_POS) {
    const len2 = p.x * p.x + p.z * p.z;
    const t = Math.max(0, Math.min(1, (x * p.x + z * p.z) / len2));
    best = Math.min(best, Math.hypot(x - p.x * t, z - p.z * t));
  }
  return best;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** 0 where the ground must be flat (plaza, paths, portal pads, beach), 1 on open meadow. */
export function hilliness(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let m = smooth(4, 7, r) * (1 - smooth(ISLAND_R - 4, ISLAND_R - 1, r));
  m *= smooth(1.6, 3.6, distToPath(x, z));
  for (const p of PORTAL_POS) m *= smooth(4.5, 7, Math.hypot(x - p.x, z - p.z));
  return m;
}

/** Ground height of the walkable island. Gentle rolling hills, flat where the child walks between worlds. */
export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const hills = 0.55 * Math.sin(x * 0.33 + 1.3) * Math.cos(z * 0.29 - 0.4) + 0.3 * Math.sin(x * 0.71 + z * 0.52) + 0.35;
  const shore = -0.45 * smooth(ISLAND_R - 1.5, ISLAND_R + 2.5, r);
  return Math.max(0, hills) * hilliness(x, z) * 1.25 + shore;
}

export const onPath = (x: number, z: number) => distToPath(x, z) < 1.4;
