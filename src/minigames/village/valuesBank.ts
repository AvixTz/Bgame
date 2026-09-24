/**
 * The values question bank ("שאלות מצב"). Every JSON file in src/content/values is loaded at build
 * time, so batches written by scripts/values/generate.mjs join the game without code changes.
 *
 * Selection: unseen items first, then items answered poorly (first choice not "best") after a
 * few days, then the rest by age; skills are rotated so a session mixes topics. The option order
 * is shuffled on every showing, so the position of the good answer never carries information.
 */
import { shuffle, type Rng } from '../../core/rng';
import type { ValueStat } from '../../data/db';

export type Quality = 'best' | 'ok' | 'poor';
export interface ValueOption { text: string; quality: Quality; feedback: string }
export interface ValueItem { id: string; skill: string; situation: string; question: string; options: ValueOption[]; home?: string }

export const VALUE_SKILLS: Record<string, string> = {
  include: 'לצרף חבר',
  breathe: 'לעצור ולנשום',
  help: 'לבקש ולהציע עזרה',
  no: 'להגיד לא',
  truth: 'לומר את האמת',
  online: 'לשמור על עצמי ברשת',
  empathy: 'להבין מה השני מרגיש',
  solve: 'לפתור ביחד',
  respect: 'לכבד',
  safety: 'לשמור על עצמי',
  responsibility: 'לקחת אחריות',
  giving: 'לתת ולשתף',
};

const files = import.meta.glob<ValueItem[]>('../../content/values/*.json', { eager: true, import: 'default' });
export const VALUE_BANK: ValueItem[] = Object.keys(files).sort().flatMap((k) => files[k]);

const DAY = 86_400_000;

/** Lower score = asked sooner. */
export function priority(item: ValueItem, stat: ValueStat | undefined, now: number): number {
  if (!stat) return 0;
  const days = (now - stat.lastAt) / DAY;
  if (stat.first !== 'best' && days >= 3) return 1;
  if (stat.first !== 'best') return 3 + stat.seen;
  return 5 + stat.seen * 2 - Math.min(days / 30, 2);
}

/**
 * Picks `n` items for a round: best priority first, ties broken randomly, and at most
 * ceil(n / 4) items from the same skill so a round is never one topic.
 */
export function pickRound(bank: ValueItem[], stats: Record<string, ValueStat>, n: number, rng: Rng, now = Date.now(), skill?: string): ValueItem[] {
  const pool = shuffle(rng, bank.filter((i) => !skill || i.skill === skill));
  const ranked = pool.map((it, k) => ({ it, p: priority(it, stats[it.id], now), k })).sort((a, b) => a.p - b.p || a.k - b.k);
  const cap = skill ? n : Math.ceil(n / 4);
  const per: Record<string, number> = {};
  const out: ValueItem[] = [];
  for (const { it } of ranked) {
    if (out.length >= n) break;
    if ((per[it.skill] ?? 0) >= cap) continue;
    per[it.skill] = (per[it.skill] ?? 0) + 1;
    out.push(it);
  }
  return out;
}

/** A fresh random order of the options for one showing. */
export const shuffledOptions = (item: ValueItem, rng: Rng): ValueOption[] => shuffle(rng, [...item.options]);

/** Share of first answers that were "best", per skill (for the parent area). */
export function skillSummary(stats: Record<string, ValueStat>, bank: ValueItem[] = VALUE_BANK) {
  const byId = new Map(bank.map((i) => [i.id, i.skill]));
  const out: Record<string, { answered: number; best: number }> = {};
  for (const [id, st] of Object.entries(stats)) {
    const s = byId.get(id);
    if (!s) continue;
    out[s] ??= { answered: 0, best: 0 };
    out[s].answered++;
    if (st.first === 'best') out[s].best++;
  }
  return out;
}
