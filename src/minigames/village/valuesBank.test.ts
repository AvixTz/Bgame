import { describe, expect, it } from 'vitest';
import { makeRng } from '../../core/rng';
import type { ValueStat } from '../../data/db';
import { VALUE_BANK, pickRound, shuffledOptions } from './valuesBank';
// @ts-expect-error - plain ESM script without types
import { validateItems } from '../../../scripts/values/validate.mjs';

describe('values bank', () => {
  it('loads every JSON file and passes the validator', () => {
    expect(VALUE_BANK.length).toBeGreaterThan(300);
    expect(validateItems(VALUE_BANK, 'ALL')).toEqual([]);
  });

  it('the good answer lands on every position about equally often', () => {
    const rng = makeRng(7);
    const four = VALUE_BANK.filter((i) => i.options.length === 4);
    const counts = [0, 0, 0, 0];
    const N = 8000;
    for (let k = 0; k < N; k++) {
      const opts = shuffledOptions(four[k % four.length], rng);
      counts[opts.findIndex((o) => o.quality === 'best')]++;
    }
    for (const c of counts) expect(Math.abs(c / N - 0.25)).toBeLessThan(0.03);
  });

  it('a round mixes skills, prefers unseen items and brings back weak answers after 3 days', () => {
    const rng = makeRng(3);
    const now = Date.now();
    const round = pickRound(VALUE_BANK, {}, 8, rng, now);
    expect(round).toHaveLength(8);
    expect(new Set(round.map((i) => i.id)).size).toBe(8);
    const per: Record<string, number> = {};
    for (const i of round) per[i.skill] = (per[i.skill] ?? 0) + 1;
    expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(2);

    // everything seen and answered well, except one weak item from 4 days ago
    const stats: Record<string, ValueStat> = Object.fromEntries(VALUE_BANK.map((i) => [i.id, { seen: 1, lastAt: now - 86_400_000, first: 'best' as const }]));
    const weak = VALUE_BANK[5];
    stats[weak.id] = { seen: 1, lastAt: now - 4 * 86_400_000, first: 'poor' };
    expect(pickRound(VALUE_BANK, stats, 8, makeRng(1), now)[0].id).toBe(weak.id);
  });

  it('a skill round stays on that skill', () => {
    const round = pickRound(VALUE_BANK, {}, 8, makeRng(9), Date.now(), 'truth');
    expect(round.every((i) => i.skill === 'truth')).toBe(true);
  });
});
