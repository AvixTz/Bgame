import { describe, expect, it } from 'vitest';
import { CHAPTERS, chapterKey, nextChapter, openChapters, tonight, type Chapter } from './storyBank';

const ch = (n: number, date: string): Chapter => ({ story: 's', number: n, title: `פרק ${n}`, publishDate: date, paragraphs: ['א'] });
const all = [ch(1, '2026-09-01'), ch(2, '2026-09-02'), ch(3, '2026-09-03')];

describe('bedtime story', () => {
  it('loads the content folder', () => {
    expect(CHAPTERS.length).toBeGreaterThan(0);
    expect(CHAPTERS.every((c) => c.story && c.paragraphs.length)).toBe(true);
  });

  it('opens chapters by publish date', () => {
    expect(openChapters('2026-09-02', all).map((c) => c.number)).toEqual([1, 2]);
    expect(nextChapter('2026-09-02', all)?.number).toBe(3);
    expect(openChapters('2026-08-01', all)).toEqual([]);
  });

  it("tonight's chapter is the newest unread one", () => {
    expect(tonight('2026-09-03', {}, all)?.number).toBe(3);
    expect(tonight('2026-09-03', { [chapterKey(all[2])]: '2026-09-03' }, all)?.number).toBe(2);
    const readAll = Object.fromEntries(all.map((c) => [chapterKey(c), 'x']));
    expect(tonight('2026-09-03', readAll, all)?.number).toBe(3);
  });
});
