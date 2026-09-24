import { describe, expect, it } from 'vitest';
import { canMarkUsed, dayDiff, dueToday, quizPassed, wordStatus, type WordProgress } from './progress';

const p = (o: Partial<WordProgress>): WordProgress => ({ shownDay: '2026-10-01', passDays: [], ...o });

describe('smarter word status', () => {
  it('counts calendar days across months', () => {
    expect(dayDiff('2026-10-03', '2026-10-01')).toBe(2);
    expect(dayDiff('2026-11-01', '2026-10-31')).toBe(1);
  });
  it('new until the word is opened', () => {
    expect(wordStatus(undefined, '2026-10-01')).toBe('new');
  });
  it('stays "shown" for the first two days even when the questions were passed', () => {
    const w = p({ passDays: ['2026-10-01', '2026-10-02'] });
    expect(wordStatus(w, '2026-10-01')).toBe('shown');
    expect(wordStatus(w, '2026-10-02')).toBe('shown');
    expect(wordStatus(w, '2026-10-03')).toBe('practice');
  });
  it('needs passes on two different days to reach practice', () => {
    expect(wordStatus(p({ passDays: ['2026-10-01'] }), '2026-10-09')).toBe('shown');
    expect(wordStatus(p({ passDays: ['2026-10-01', '2026-10-01'] }), '2026-10-09')).toBe('shown');
    expect(wordStatus(p({ passDays: ['2026-10-01', '2026-10-05'] }), '2026-10-09')).toBe('practice');
  });
  it('real-life use can be marked only from day 3, once in practice', () => {
    const w = p({ passDays: ['2026-10-01', '2026-10-02'] });
    expect(canMarkUsed(w, '2026-10-03')).toBe(false);
    expect(canMarkUsed(w, '2026-10-04')).toBe(true);
    expect(canMarkUsed(p({ passDays: ['2026-10-01'] }), '2026-10-09')).toBe(false);
    expect(wordStatus({ ...w, usedDay: '2026-10-04' }, '2026-10-04')).toBe('known');
  });
  it('a quiz passes with at most one question needing a second try', () => {
    expect(quizPassed(3, 3)).toBe(true);
    expect(quizPassed(2, 3)).toBe(true);
    expect(quizPassed(3, 5)).toBe(false);
  });
  it("today's list: unpassed today, or ready to mark", () => {
    expect(dueToday(p({}), '2026-10-01')).toBe(true);
    expect(dueToday(p({ passDays: ['2026-10-01'] }), '2026-10-01')).toBe(false);
    expect(dueToday(p({ passDays: ['2026-10-01'] }), '2026-10-02')).toBe(true);
    expect(dueToday(p({ passDays: ['2026-10-01', '2026-10-02'] }), '2026-10-03')).toBe(false);
    expect(dueToday(p({ passDays: ['2026-10-01', '2026-10-02'] }), '2026-10-04')).toBe(true);
  });
});
