import { describe, expect, it } from 'vitest';
import { NODES } from './curriculum';
import { classifyMistake, generateItem } from './generators';
import {
  DAY, REVIEW_DAYS, chooseTier, isUnlocked, newSkill, recommend, seedFromPlacement, updateSkill,
  placementNext, PLACEMENT_ANCHORS,
} from './model';
import { buildReport } from './insights';
import { makeRng, g } from '../core/rng';
import { weeklyProgress, dayKey } from '../economy/economy';
import type { SkillState } from './types';

const units = (n: number) => n % 10;

/** Evaluate "a op b [op c]" with ☐ unknown solved from the answer, to cross-check generators. */
function evalExpr(expr: string): number {
  const js = expr.replace(/×/g, '*').replace(/−/g, '-').replace(/:/g, '/');
  return Function(`return (${js})`)() as number;
}

describe('generators', () => {
  it('every node and tier yields a correct, positive integer answer', () => {
    for (const node of NODES) {
      for (const tier of [1, 2, 3] as const) {
        const rng = makeRng(node.id.length * 97 + tier);
        for (let i = 0; i < 300; i++) {
          const item = generateItem(node.id, tier, rng);
          expect(Number.isInteger(item.answer)).toBe(true);
          expect(item.answer).toBeGreaterThanOrEqual(0);
          expect(item.hints).toHaveLength(3);
          if (item.expr && !item.expr.includes('☐') && !item.choices) {
            expect(evalExpr(item.expr)).toBe(item.answer);
          }
          if (item.expr?.includes('☐')) {
            const solved = item.expr.replace('☐', String(item.answer)).split('=');
            expect(evalExpr(solved[0])).toBe(Number(solved[1]));
          }
          if (item.choices) {
            expect(item.choices).toContain(item.correctChoice);
            expect(new Set(item.choices).size).toBe(item.choices.length);
          }
        }
      }
    }
  });

  it('grade ב add/sub stay within 100 and respect carry rules', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i++) {
      for (const tier of [1, 2, 3] as const) {
        const add = generateItem('b_add', tier, rng);
        const [a, b] = add.expr!.match(/\d+/g)!.map(Number);
        expect(units(a) + units(b)).toBeLessThan(10);
        expect(add.answer).toBeLessThanOrEqual(99);

        const carry = generateItem('b_add_carry', tier, rng);
        const nums = carry.expr!.match(/\d+/g)!.map(Number);
        expect(nums.reduce((s, n) => s + units(n), 0)).toBeGreaterThanOrEqual(10);
        expect(carry.answer).toBeLessThanOrEqual(100);

        const sub = generateItem('b_sub', tier, rng);
        const [c, d] = sub.expr!.match(/\d+/g)!.map(Number);
        expect(units(c)).toBeGreaterThanOrEqual(units(d));
        expect(sub.answer).toBeGreaterThanOrEqual(0);

        const borrow = generateItem('b_sub_borrow', tier, rng);
        const [e, f] = borrow.expr!.match(/\d+/g)!.map(Number);
        expect(units(e)).toBeLessThan(units(f));
        expect(borrow.answer).toBeGreaterThan(0);
      }
    }
  });

  it('multiplication stays within the table and remainders are smaller than the divisor', () => {
    const rng = makeRng(11);
    for (let i = 0; i < 300; i++) {
      for (const id of ['g_mult_easy', 'g_mult_mid', 'g_mult_hard']) {
        const it = generateItem(id, 3, rng);
        const [a, b] = it.expr!.match(/\d+/g)!.map(Number);
        expect(a).toBeLessThanOrEqual(10);
        expect(b).toBeLessThanOrEqual(10);
      }
      const r = generateItem('g_div_rem', 2, rng);
      const [, div] = r.expr!.match(/\d+/g)!.map(Number);
      expect(r.answer % 100).toBeLessThan(div);
      expect(r.answer % 100).toBeGreaterThan(0);
    }
  });
});

describe('mistake classifier', () => {
  const item = (nodeId: string, expr: string, answer: number) =>
    ({ ...generateItem(nodeId, 2, makeRng(1)), expr, answer });

  it('recognises carry and borrow errors', () => {
    expect(classifyMistake(item('b_add_carry', '38 + 27', 65), '55')).toBe('forgot_carry');
    expect(classifyMistake(item('b_add_carry', '38 + 27', 65), '515')).toBe('digit_concat');
    expect(classifyMistake(item('b_sub_borrow', '52 − 17', 35), '45')).toBe('smaller_from_larger');
    expect(classifyMistake(item('b_sub_borrow', '52 − 17', 35), '45')).not.toBe('forgot_borrow');
    expect(classifyMistake(item('b_sub_borrow', '63 − 28', 35), '45')).toBe('smaller_from_larger');
    expect(classifyMistake(item('b_sub_borrow', '60 − 24', 36), '44')).toBe('smaller_from_larger');
    expect(classifyMistake(item('b_sub_borrow', '60 − 24', 36), '46')).toBe('forgot_borrow');
  });

  it('recognises multiplication slips and wrong operations', () => {
    expect(classifyMistake(item('g_mult_hard', '7 × 8', 56), '49')).toBe('skip_count_slip');
    expect(classifyMistake(item('g_mult_hard', '7 × 8', 56), '15')).toBe('wrong_operation');
    expect(classifyMistake(item('g_div', '42 : 6', 7), '8')).toBe('skip_count_slip');
    expect(classifyMistake(item('b_place', '', 35), '53')).toBe('swapped_digits');
  });
});

describe('learner model', () => {
  it('ability rises with correct answers and leads to mastery then review scheduling', () => {
    let s: SkillState = newSkill('b_add', -1);
    const rng = makeRng(3);
    let now = 1_000_000;
    let mastered = false;
    for (let i = 0; i < 40 && !mastered; i++) {
      const tier = chooseTier(s, 0.8);
      const it = generateItem('b_add', tier, rng);
      const r = updateSkill(s, it, true, { now, isReview: false, hintsUsed: 0 });
      s = r.skill;
      mastered = r.becameMastered;
      now += 60_000;
    }
    expect(mastered).toBe(true);
    expect(s.nextReviewAt).toBe(s.masteredAt! + REVIEW_DAYS[0] * DAY);

    const review = generateItem('b_add', 3, rng);
    const kept = updateSkill(s, review, true, { now: s.nextReviewAt!, isReview: true, hintsUsed: 0 }).skill;
    expect(kept.reviewStage).toBe(1);
    const lost = updateSkill(kept, review, false, { now: kept.nextReviewAt!, isReview: true, hintsUsed: 0 }).skill;
    expect(lost.reviewStage).toBe(0);
    expect(lost.mastered).toBe(true);
    const forgotten = updateSkill(lost, review, false, { now: lost.nextReviewAt!, isReview: true, hintsUsed: 0 }).skill;
    expect(forgotten.mastered).toBe(false);
  });

  it('chooses harder tiers as ability grows', () => {
    expect(chooseTier(newSkill('g_mult_hard', -1), 0.8)).toBe(1);
    expect(chooseTier(newSkill('g_mult_hard', 3.5), 0.8)).toBe(3);
  });

  it('keeps later nodes locked until prerequisites are known', () => {
    expect(isUnlocked('b_place', {})).toBe(true);
    expect(isUnlocked('b_add', {})).toBe(false);
    expect(isUnlocked('b_add', { b_place: { ...newSkill('b_place', 2), n: 5 } })).toBe(true);
  });

  it('recommends only unlocked nodes and puts due reviews first', () => {
    const rng = makeRng(5);
    for (let i = 0; i < 50; i++) {
      const p = recommend({}, { now: 0, grade: 2, sessionRecent: [], rng });
      expect(p.nodeId).toBe('b_place');
    }
    const skills: Record<string, SkillState> = {
      b_place: { ...newSkill('b_place', 3), n: 10, mastered: true, nextReviewAt: 10 },
    };
    expect(recommend(skills, { now: 100, grade: 2, sessionRecent: [], rng }).reason).toBe('review');
  });

  it('placement moves up on success, down on failure, and seeds skills', () => {
    expect(placementNext(1, true, 1)).toBe(2);
    expect(placementNext(1, false, 1)).toBe(0);
    expect(placementNext(3, true, 6)).toBeNull();
    const skills = seedFromPlacement(
      PLACEMENT_ANCHORS.slice(0, 7).map((a) => ({ nodeId: a.nodeId, correct: true })), 3, 0,
    );
    // Everything up to the highest passed anchor is provisionally known, the frontier is open.
    for (const a of PLACEMENT_ANCHORS.slice(0, 7)) expect(skills[a.nodeId].mastered).toBe(true);
    expect(skills.b_missing.mastered).toBe(true);
    expect(isUnlocked('g_mult_mid', skills)).toBe(true);
    expect(skills.g_mult_mid.mastered).toBe(false);
    // Daily practice goes to the frontier, not back to grade ב.
    const rng = makeRng(9);
    for (let i = 0; i < 30; i++) {
      const p = recommend(skills, { now: 0, grade: 3, sessionRecent: [], rng });
      expect(['focus', 'new', 'practice']).toContain(p.reason);
      if (p.reason !== 'practice') expect(NODES.find((n) => n.id === p.nodeId)!.grade).toBe(3);
    }
    // A weak placement keeps grade ב topics in practice.
    const weak = seedFromPlacement([{ nodeId: 'b_add_carry', correct: false }, { nodeId: 'b_add', correct: false }], 2, 0);
    expect(weak.b_add.mastered).toBe(false);
    expect(weak.b_add_carry.mastered).toBe(false);
  });
});

describe('insights and economy', () => {
  it('reports struggling nodes and mistake patterns', () => {
    const s = { ...newSkill('b_add_carry', -1), n: 6, recent: [false, false, true, false, false, false], mistakes: { forgot_carry: 4 } };
    const r = buildReport({ b_place: { ...newSkill('b_place', 2), n: 5 }, b_add: { ...newSkill('b_add', 2), n: 5 }, b_add_carry: s }, {}, [], 0);
    expect(r.focus).toContain('חיבור עם המרה (מעבר עשרת)');
    expect(r.patterns[0].type).toBe('forgot_carry');
  });

  it('weekly goal counts days inside the Sunday-Saturday week', () => {
    const wed = new Date(2026, 8, 23, 10).getTime(); // Wednesday
    const played = [dayKey(new Date(2026, 8, 20, 10).getTime()), dayKey(wed), dayKey(new Date(2026, 8, 19, 10).getTime())];
    const w = weeklyProgress(played, wed);
    expect(w.done).toBe(2); // Saturday the 19th belongs to the previous week
    expect(w.days.find((d) => d.today)?.played).toBe(true);
  });

  it('gendered text helper', () => {
    expect(g('בד{וק|קי} שוב', 'm')).toBe('בדוק שוב');
    expect(g('בד{וק|קי} שוב', 'f')).toBe('בדקי שוב');
  });
});
