/** Static colliders on the island: [x, z, radius]. Filled by the scenery as it is generated. */
export const obstacles: [number, number, number][] = [];

export function setObstacles(group: string, list: [number, number, number][]) {
  byGroup.set(group, list);
  obstacles.length = 0;
  for (const l of byGroup.values()) obstacles.push(...l);
}
const byGroup = new Map<string, [number, number, number][]>();
