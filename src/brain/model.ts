import { NODES, NODE_BY_ID } from './curriculum';
import type { Grade, Item, MistakeType, SkillState, StrategyId, StrategyState, Subject } from './types';
import type { Rng } from '../core/rng';

export const DAY = 24 * 60 * 60 * 1000;
/** Expanding review ladder in days (Cepeda 2006; Lindsey et al. 2014). */
export const REVIEW_DAYS = [1, 3, 7, 14, 30];
/** Target first-try success (Wilson et al. 2019 is a starting point, tuned from data later). */
export const TARGET_P = 0.8;
export const TARGET_P_STRUGGLING = 0.88;

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const expected = (theta: number, difficulty: number) => sigmoid(theta - difficulty);

/** Elo step size shrinks as evidence accumulates (Pelánek 2016). */
export const kFactor = (n: number) => Math.max(0.3, 1.2 / (1 + 0.08 * n));

export function newSkill(nodeId: string, theta = -1): SkillState {
  return { nodeId, theta, n: 0, recent: [], mastered: false, reviewStage: 0, mistakes: {} };
}

export function newStrategy(id: StrategyId): StrategyState {
  return { id, theta: 0, n: 0, selfReported: 0 };
}

/** Prior ability for a node given the child's school grade: own-grade and lower-grade nodes start closer. */
export function priorTheta(nodeGrade: Grade, childGrade: Grade): number {
  return nodeGrade < childGrade ? 0.2 : -1.0;
}

/**
 * Mastery = predicted first-try success on the hardest tier >= 0.8, with at least 6 attempts
 * and at least 4 of the last 5 first-try correct. A pragmatic stand-in for BKT's P(L) >= 0.95.
 */
export function isMastered(s: SkillState): boolean {
  const node = NODE_BY_ID[s.nodeId];
  const pTop = expected(s.theta, node.tierDifficulty[2]);
  const last5 = s.recent.slice(-5);
  return s.n >= 6 && pTop >= 0.8 && last5.length >= 5 && last5.filter(Boolean).length >= 4;
}

export interface UpdateResult {
  skill: SkillState;
  becameMastered: boolean;
  p: number;
}

export function updateSkill(
  prev: SkillState,
  item: Item,
  firstTryCorrect: boolean,
  opts: { now: number; isReview: boolean; mistake?: MistakeType; hintsUsed: number },
): UpdateResult {
  const p = expected(prev.theta, item.difficulty);
  // A hinted success counts as partial evidence.
  const outcome = firstTryCorrect ? (opts.hintsUsed > 0 ? 0.6 : 1) : 0;
  const s: SkillState = {
    ...prev,
    theta: prev.theta + kFactor(prev.n) * (outcome - p),
    n: prev.n + 1,
    recent: [...prev.recent, firstTryCorrect && opts.hintsUsed === 0].slice(-10),
    lastSeen: opts.now,
    mistakes: { ...prev.mistakes },
  };
  if (opts.mistake) s.mistakes[opts.mistake] = (s.mistakes[opts.mistake] ?? 0) + 1;

  let becameMastered = false;
  if (!s.mastered && isMastered(s)) {
    s.mastered = true;
    s.masteredAt = opts.now;
    s.reviewStage = 0;
    s.nextReviewAt = opts.now + REVIEW_DAYS[0] * DAY;
    becameMastered = true;
  } else if (s.mastered && opts.isReview) {
    if (firstTryCorrect) {
      s.reviewStage = Math.min(s.reviewStage + 1, REVIEW_DAYS.length - 1);
      s.nextReviewAt = opts.now + REVIEW_DAYS[s.reviewStage] * DAY;
    } else if (s.recent.slice(-3).filter((x) => !x).length >= 2) {
      // Forgotten (or placement over-estimated it): back to active practice.
      s.mastered = false;
      s.masteredAt = undefined;
      s.nextReviewAt = undefined;
      s.reviewStage = 0;
    } else {
      s.reviewStage = 0;
      s.nextReviewAt = opts.now + REVIEW_DAYS[0] * DAY;
    }
  }
  return { skill: s, becameMastered, p };
}

export function updateStrategy(prev: StrategyState, difficulty: number, correct: boolean): StrategyState {
  const p = expected(prev.theta, difficulty);
  return { ...prev, theta: prev.theta + 0.5 * kFactor(prev.n) * ((correct ? 1 : 0) - p), n: prev.n + 1 };
}

export type NodeStatus = 'locked' | 'new' | 'learning' | 'struggling' | 'mastered' | 'review_due';

export function nodeStatus(nodeId: string, skills: Record<string, SkillState>, now: number): NodeStatus {
  const s = skills[nodeId];
  if (!isUnlocked(nodeId, skills)) return 'locked';
  if (!s || s.n === 0) return 'new';
  if (s.mastered) return s.nextReviewAt !== undefined && s.nextReviewAt <= now ? 'review_due' : 'mastered';
  const last = s.recent.slice(-6);
  if (last.length >= 4 && last.filter(Boolean).length / last.length < 0.5) return 'struggling';
  return 'learning';
}

/** A node opens when each prerequisite is mastered or predicted ≥0.7 on its middle tier. */
export function isUnlocked(nodeId: string, skills: Record<string, SkillState>): boolean {
  return NODE_BY_ID[nodeId].prerequisites.every((pre) => {
    const s = skills[pre];
    if (!s) return false;
    return s.mastered || (s.n >= 3 && expected(s.theta, NODE_BY_ID[pre].tierDifficulty[1]) >= 0.7);
  });
}

/** Pick the tier whose predicted success is closest to the target. */
export function chooseTier(s: SkillState, target: number): 1 | 2 | 3 {
  const node = NODE_BY_ID[s.nodeId];
  let best: 1 | 2 | 3 = 1;
  let bestGap = Infinity;
  node.tierDifficulty.forEach((d, i) => {
    const gap = Math.abs(expected(s.theta, d) - target);
    if (gap < bestGap) { bestGap = gap; best = (i + 1) as 1 | 2 | 3; }
  });
  return best;
}

/** Recent frustration: 2 misses in a row → aim easier (never two hard items in a row). */
export function isStruggling(recentFirstTry: boolean[]): boolean {
  const last = recentFirstTry.slice(-2);
  return last.length === 2 && !last[0] && !last[1];
}

export interface Pick { nodeId: string; tier: 1 | 2 | 3; reason: 'review' | 'focus' | 'new' | 'practice' }

/**
 * Next item for the daily journey.
 * Order: due reviews first (retrieval practice) → a node the child is learning → a newly unlocked node.
 * Mixing in a mastered node now and then keeps it fresh (interleaving).
 */
export function recommend(
  skills: Record<string, SkillState>,
  opts: { now: number; grade: Grade; sessionRecent: boolean[]; rng: Rng; avoidNode?: string; allowedGrades?: Grade[]; subject?: Subject },
): Pick {
  const grades = opts.allowedGrades ?? [2, 3];
  const subject = opts.subject ?? 'math';
  const candidates = NODES.filter((n) => grades.includes(n.grade) && n.subject === subject);
  const target = isStruggling(opts.sessionRecent) ? TARGET_P_STRUGGLING : TARGET_P;
  const get = (id: string) => skills[id] ?? newSkill(id, priorTheta(NODE_BY_ID[id].grade, opts.grade));

  const due = candidates.filter((n) => nodeStatus(n.id, skills, opts.now) === 'review_due' && n.id !== opts.avoidNode);
  if (due.length) {
    due.sort((a, b) => (skills[a.id].nextReviewAt ?? 0) - (skills[b.id].nextReviewAt ?? 0));
    const s = get(due[0].id);
    // Reviews check retention at the hardest tier the child mastered.
    return { nodeId: s.nodeId, tier: isStruggling(opts.sessionRecent) ? 2 : 3, reason: 'review' };
  }

  const open = candidates.filter((n) => isUnlocked(n.id, skills));
  const learning = open.filter((n) => {
    const st = nodeStatus(n.id, skills, opts.now);
    return (st === 'learning' || st === 'struggling') && n.id !== opts.avoidNode;
  });
  const fresh = open.filter((n) => nodeStatus(n.id, skills, opts.now) === 'new');
  const mastered = open.filter((n) => nodeStatus(n.id, skills, opts.now) === 'mastered' && n.id !== opts.avoidNode);

  const r = opts.rng();
  if (mastered.length && r < 0.15) {
    const n = mastered[Math.floor(opts.rng() * mastered.length)];
    return { nodeId: n.id, tier: chooseTier(get(n.id), target), reason: 'practice' };
  }
  if (learning.length && (r < 0.8 || !fresh.length)) {
    // Prefer the weakest learning node, but not always the same one.
    learning.sort((a, b) => get(a.id).theta - NODE_BY_ID[a.id].tierDifficulty[1] - (get(b.id).theta - NODE_BY_ID[b.id].tierDifficulty[1]));
    const n = learning[opts.rng() < 0.7 ? 0 : Math.floor(opts.rng() * learning.length)];
    return { nodeId: n.id, tier: chooseTier(get(n.id), target), reason: 'focus' };
  }
  if (fresh.length) {
    // Lowest grade first, then curriculum order.
    const n = fresh[0];
    return { nodeId: n.id, tier: 1, reason: 'new' };
  }
  const any = open.length ? open : candidates.slice(0, 1);
  const n = any[Math.floor(opts.rng() * any.length)];
  return { nodeId: n.id, tier: chooseTier(get(n.id), target), reason: 'practice' };
}

/**
 * Placement: a short adaptive walk over anchor nodes. Each answer shifts the estimate of the child's
 * position; nodes below the final position are seeded as partly known, nodes above start fresh.
 */
export const PLACEMENT_ANCHORS: { nodeId: string; tier: 1 | 2 | 3 }[] = [
  { nodeId: 'b_place', tier: 2 },
  { nodeId: 'b_add', tier: 3 },
  { nodeId: 'b_sub', tier: 3 },
  { nodeId: 'b_add_carry', tier: 2 },
  { nodeId: 'b_sub_borrow', tier: 2 },
  { nodeId: 'b_mult_intro', tier: 2 },
  { nodeId: 'g_mult_easy', tier: 3 },
  { nodeId: 'g_mult_mid', tier: 2 },
  { nodeId: 'g_div', tier: 2 },
  { nodeId: 'g_mult_hard', tier: 3 },
];

export function placementStart(grade: Grade): number {
  return grade === 2 ? 1 : 4;
}

/** Returns next anchor index, or null when placement is done (6 answers). */
export function placementNext(index: number, correct: boolean, answered: number): number | null {
  if (answered >= 6) return null;
  const next = correct ? index + 1 : index - 1;
  if (next < 0 || next >= PLACEMENT_ANCHORS.length) return null;
  return next;
}

export function seedFromPlacement(
  results: { nodeId: string; correct: boolean }[],
  grade: Grade,
  now: number,
): Record<string, SkillState> {
  const skills: Record<string, SkillState> = {};
  const passed = new Set(results.filter((r) => r.correct).map((r) => r.nodeId));
  const failed = new Set(results.filter((r) => !r.correct).map((r) => r.nodeId));
  const highestPassed = Math.max(-1, ...PLACEMENT_ANCHORS.map((a, i) => (passed.has(a.nodeId) ? i : -1)));

  /** Provisionally mastered: skipped in daily practice, but checked by a spaced review soon. */
  const provisional = (id: string, reviewInDays: number): SkillState => ({
    ...newSkill(id, NODE_BY_ID[id].tierDifficulty[2] + 0.6),
    n: 3, mastered: true, masteredAt: now, reviewStage: 0, nextReviewAt: now + reviewInDays * DAY,
  });

  const mathNodes = NODES.filter((n) => n.subject === 'math');
  for (const node of mathNodes) {
    const idx = PLACEMENT_ANCHORS.findIndex((a) => a.nodeId === node.id);
    if (failed.has(node.id)) {
      skills[node.id] = newSkill(node.id, node.tierDifficulty[0] - 0.3);
    } else if (passed.has(node.id)) {
      skills[node.id] = provisional(node.id, 3);
    } else if (idx >= 0 && idx < highestPassed) {
      skills[node.id] = provisional(node.id, 1);
    } else {
      skills[node.id] = newSkill(node.id, priorTheta(node.grade, grade));
    }
  }
  // Non-anchor nodes of a lower grade whose prerequisites are all provisionally known are known too.
  for (const node of mathNodes) {
    if (PLACEMENT_ANCHORS.some((a) => a.nodeId === node.id) || node.grade >= grade) continue;
    if (node.prerequisites.every((pre) => skills[pre]?.mastered)) skills[node.id] = provisional(node.id, 2);
  }
  // Prerequisites of a passed anchor are known as well.
  for (const id of passed) {
    for (const pre of NODE_BY_ID[id].prerequisites) {
      if (!skills[pre].mastered && !failed.has(pre)) skills[pre] = provisional(pre, 1);
    }
  }
  return skills;
}
