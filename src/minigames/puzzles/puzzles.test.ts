import { describe, expect, it } from 'vitest';
import { makeRng } from '../../core/rng';
import { CATEGORIES } from './wordLists';
import { WS_LEVELS, makeWordGrid, matchSelection, straightLine } from './wordSearch';
import { MS_LEVELS, checkMathSelection, isCorrect, makeMathGrid, type Token } from './mathSearch';

const HEB = /^[א-ת]+$/;

describe('word lists', () => {
  it('are single Hebrew words without duplicates in a category', () => {
    for (const c of CATEGORIES) {
      expect(new Set(c.words).size).toBe(c.words.length);
      for (const w of c.words) expect(w, `${c.id}: ${w}`).toMatch(HEB);
      expect(c.words.filter((w) => w.length >= 3 && w.length <= 8).length, c.id).toBeGreaterThanOrEqual(9);
    }
  });
  it('final letters appear only at the end of a word', () => {
    for (const c of CATEGORIES) for (const w of c.words) expect(/[ךםןףץ]./.test(w), w).toBe(false);
  });
});

describe('word search', () => {
  it('builds every category at every level, each word exactly where it was placed', () => {
    let seed = 1;
    for (const level of [1, 2, 3] as const) for (const cat of CATEGORIES) {
      const g = makeWordGrid(level, cat.words, makeRng(seed++));
      const cfg = WS_LEVELS[level];
      expect(g.placements).toHaveLength(cfg.words);
      for (const p of g.placements) {
        expect(p.cells.map(([r, c]) => g.letters[r][c]).join('')).toBe(p.word);
        const d: [number, number] = [Math.sign(p.end[0] - p.start[0]), Math.sign(p.end[1] - p.start[1])];
        expect(cfg.dirs.some(([a, b]) => a === d[0] && b === d[1])).toBe(true);
        expect(matchSelection(g, p.end, p.start)?.word).toBe(p.word);
      }
    }
  });
  it('level 1 words read right to left or top to bottom only', () => {
    const g = makeWordGrid(1, CATEGORIES[0].words, makeRng(5));
    for (const p of g.placements) expect(p.start[0] === p.end[0] ? p.end[1] > p.start[1] : p.end[0] > p.start[0] && p.start[1] === p.end[1]).toBe(true);
  });
  it('straight lines only', () => {
    expect(straightLine([0, 0], [2, 2])).toHaveLength(3);
    expect(straightLine([0, 0], [1, 2])).toBeNull();
  });
});

const num = (value: number): Token => ({ kind: 'num', value });
const op = (o: '+' | '-' | '×' | '='): Token => ({ kind: 'op', op: o });

describe('exercise search', () => {
  it('knows a correct exercise in both directions of "="', () => {
    expect(isCorrect([num(7), op('+'), num(5), op('='), num(12)])).toBe(true);
    expect(isCorrect([num(12), op('='), num(7), op('+'), num(5)])).toBe(true);
    expect(isCorrect([num(7), op('+'), num(5), op('='), num(13)])).toBe(false);
    expect(isCorrect([num(7), op('+'), num(5), op('+'), num(12)])).toBe(false);
    expect(isCorrect([num(6), op('×'), num(7), op('='), num(42)])).toBe(true);
  });
  it('boards have the planted exercises, all listed ones are correct and selectable', () => {
    for (const level of [1, 2, 3] as const) for (let s = 0; s < 30; s++) {
      const g = makeMathGrid(level, makeRng(100 * level + s));
      const cfg = MS_LEVELS[level];
      expect(g.correct.length).toBeGreaterThanOrEqual(cfg.plant);
      expect(g.correct.length).toBeLessThanOrEqual(cfg.plant + 3);
      for (const ex of g.correct) {
        expect(isCorrect(ex.cells.map(([r, c]) => g.tokens[r][c]))).toBe(true);
        expect(checkMathSelection(g, ex.cells[4], ex.cells[0])).toBe(ex);
      }
      const nums = g.tokens.flat().filter((t) => t.kind === 'num').map((t) => (t as { value: number }).value);
      expect(Math.min(...nums)).toBeGreaterThanOrEqual(0);
      if (level < 3) expect(g.tokens.flat().some((t) => t.kind === 'op' && t.op === '×')).toBe(false);
    }
  });
  it('rejects selections that are not exercises', () => {
    const g = makeMathGrid(1, makeRng(1));
    expect(checkMathSelection(g, [0, 0], [0, 2])).toBeNull();
    expect(checkMathSelection(g, [0, 0], [2, 2])).toBeNull();
    expect(checkMathSelection(g, [0, 1], [0, 5])).toBeNull();
  });
  it('level 3 has wrong exercises that look right', () => {
    const g = makeMathGrid(3, makeRng(9));
    let wrong = 0;
    for (let r = 0; r < g.rows; r += 2) for (let c = 0; c + 4 < g.cols; c += 2) {
      const t = g.tokens[r][c + 3];
      if (t.kind === 'op' && t.op === '=' && checkMathSelection(g, [r, c], [r, c + 4]) === 'wrong') wrong++;
    }
    expect(wrong).toBeGreaterThan(0);
  });
});
