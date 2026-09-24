import { describe, expect, it } from 'vitest';
import { DOMAINS, WORDS, WORD_BY_TEXT, plainStory, storyParts } from './wordBank';
// @ts-expect-error - plain ESM script without types
import { validateWords } from '../../../scripts/smarter/validate.mjs';

describe('smarter word bank', () => {
  it('loads every domain file and passes the validator', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(100);
    expect(validateWords(WORDS, DOMAINS.map((d) => d.id), 'ALL')).toEqual([]);
    for (const d of DOMAINS) expect(WORDS.some((w) => w.domain === d.id), d.id).toBe(true);
  });
  it('related words point to words in the bank', () => {
    const missing = WORDS.flatMap((w) => (w.related ?? []).filter((r) => !WORD_BY_TEXT.has(r)).map((r) => `${w.word} -> ${r}`));
    expect(missing).toEqual([]);
  });
  it('right answers are spread over positions in the files (the app shuffles anyway)', () => {
    const qs = WORDS.flatMap((w) => w.questions);
    const first = qs.filter((q) => q.answer === 0).length / qs.length;
    expect(first).toBeLessThan(0.7);
  });
  it('highlights the marked word in the story', () => {
    expect(storyParts('היא [[השקיעה]] זמן')).toEqual([{ mark: false, t: 'היא ' }, { mark: true, t: 'השקיעה' }, { mark: false, t: ' זמן' }]);
    expect(plainStory('היא [[השקיעה]] זמן')).toBe('היא השקיעה זמן');
  });
});
