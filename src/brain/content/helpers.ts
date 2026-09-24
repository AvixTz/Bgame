import type { Hint, StrategyId } from '../types';
import type { Draft } from '../generators';
import { shuffle, type Rng } from '../../core/rng';

export const hints3 = (a: string, b: string, c: string): [Hint, Hint, Hint] => [
  { level: 1, text: a },
  { level: 2, text: b },
  { level: 3, text: c },
];

/** A multiple-choice draft. `answer` is unused for choice items and set to 0. */
export function choiceDraft(
  rng: Rng,
  o: {
    key: string;
    prompt: string;
    speech?: string;
    passage?: string;
    correct: string;
    wrong: string[];
    strategies: StrategyId[];
    hints: [Hint, Hint, Hint];
    explain: string;
    feedback?: Record<string, string>;
  },
): Draft {
  const wrong = [...new Set(o.wrong.filter((w) => w !== o.correct))].slice(0, 3);
  return {
    key: o.key,
    prompt: o.prompt,
    passage: o.passage,
    speech: o.speech ?? (o.passage ? `${o.passage} ${o.prompt}` : o.prompt),
    answer: 0,
    choices: shuffle(rng, [o.correct, ...wrong]),
    correctChoice: o.correct,
    choiceFeedback: o.feedback,
    strategies: o.strategies,
    hints: o.hints,
    explain: o.explain,
  };
}

export interface BankItem {
  q: string;
  correct: string;
  wrong: string[];
  explain: string;
  hint?: string;
  feedback?: Record<string, string>;
}

/** Generator over a fixed question bank split into three tiers. */
export function bankGenerator(
  bank: [BankItem[], BankItem[], BankItem[]],
  strategies: StrategyId[],
  firstHint: string,
) {
  return (rng: Rng, tier: 1 | 2 | 3): Draft => {
    const list = bank[tier - 1];
    const idx = Math.floor(rng() * list.length);
    const it = list[idx];
    return choiceDraft(rng, {
      key: `t${tier}-${idx}`,
      prompt: it.q,
      correct: it.correct,
      wrong: it.wrong,
      strategies,
      hints: hints3(firstHint, it.hint ?? 'איזו תשובה בטוח לא מתאימה? מחקו אותה בראש.', it.explain),
      explain: it.explain,
      feedback: it.feedback,
    });
  };
}
