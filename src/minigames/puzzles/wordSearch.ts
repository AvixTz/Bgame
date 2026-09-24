/**
 * Word search (תפזורת מילים). Pure and deterministic for a given rng.
 *
 * The grid is rendered right-to-left, so column 0 is on the right and dc = +1 reads the way Hebrew
 * is read. Levels follow fixed rules:
 *   1: 8x8, 5 words, right-to-left and top-to-bottom only.
 *   2: 10x10, 7 words, adds the two downward diagonals.
 *   3: 12x12, 9 words, all 8 directions (words may be written backwards), and the filler letters
 *      are drawn mostly from the hidden words, so there are many false starts. No hints.
 * Every word appears exactly once in the grid (checked in all 8 directions).
 */
import { shuffle, type Rng } from '../../core/rng';

export type Cell = [number, number];
export interface Placement { word: string; start: Cell; end: Cell; cells: Cell[] }
export interface WordGrid { size: number; letters: string[][]; placements: Placement[] }

export const WS_LEVELS = {
  1: { size: 8, words: 5, dirs: [[0, 1], [1, 0]] as Cell[] },
  2: { size: 10, words: 7, dirs: [[0, 1], [1, 0], [1, 1], [1, -1]] as Cell[] },
  3: { size: 12, words: 9, dirs: [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]] as Cell[] },
} as const;

export const WS_RULES: Record<number, string[]> = {
  1: ['לוח 8 על 8, חמש מילים', 'מילים רק מימין לשמאל ומלמעלה למטה', 'יש רמזים'],
  2: ['לוח 10 על 10, שבע מילים', 'גם באלכסון למטה', 'יש רמזים'],
  3: ['לוח 12 על 12, תשע מילים', 'בכל הכיוונים, גם מילים הפוכות', 'הרבה אותיות מטעות מתוך המילים עצמן', 'בלי רמזים'],
};

const ALL_DIRS: Cell[] = WS_LEVELS[3].dirs.map((d) => [...d] as Cell);
const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
const FINALS = 'ךםןףץ';

const lineCells = (start: Cell, dir: Cell, len: number): Cell[] =>
  Array.from({ length: len }, (_, i) => [start[0] + dir[0] * i, start[1] + dir[1] * i] as Cell);

/** Cells from a to b if they form a straight line (row, column or diagonal), else null. */
export function straightLine(a: Cell, b: Cell): Cell[] | null {
  const dr = b[0] - a[0], dc = b[1] - a[1];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const len = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  return lineCells(a, [Math.sign(dr), Math.sign(dc)], len);
}

function countOccurrences(letters: string[][], word: string): number {
  const n = letters.length;
  let count = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const d of ALL_DIRS) {
    const cells = lineCells([r, c], d, word.length);
    if (cells.every(([y, x], i) => y >= 0 && x >= 0 && y < n && x < n && letters[y][x] === word[i])) count++;
  }
  // A palindrome is found twice from the same cells (once per direction).
  return word === [...word].reverse().join('') ? count / 2 : count;
}

/** Builds a puzzle from a category's words. Words shorter than 3 letters are left out. */
export function makeWordGrid(level: 1 | 2 | 3, pool: string[], rng: Rng): WordGrid {
  const cfg = WS_LEVELS[level];
  const n = cfg.size;
  const candidates = shuffle(rng, pool.filter((w) => w.length >= 3 && w.length <= n));
  for (let attempt = 0; attempt < 40; attempt++) {
    const letters: string[][] = Array.from({ length: n }, () => Array(n).fill(''));
    const placements: Placement[] = [];
    const chosen = candidates.slice(0, cfg.words + 4).sort((a, b) => b.length - a.length);
    for (const word of chosen) {
      if (placements.length >= cfg.words) break;
      if (placements.some((p) => p.word.includes(word) || word.includes(p.word))) continue;
      for (let t = 0; t < 150; t++) {
        const dir = cfg.dirs[Math.floor(rng() * cfg.dirs.length)];
        const start: Cell = [Math.floor(rng() * n), Math.floor(rng() * n)];
        const cells = lineCells(start, dir, word.length);
        if (!cells.every(([r, c], i) => r >= 0 && c >= 0 && r < n && c < n && (letters[r][c] === '' || letters[r][c] === word[i]))) continue;
        cells.forEach(([r, c], i) => { letters[r][c] = word[i]; });
        placements.push({ word, start, end: cells[cells.length - 1], cells });
        break;
      }
    }
    if (placements.length < cfg.words) continue;
    const fromWords = placements.map((p) => p.word).join('');
    for (let fill = 0; fill < 30; fill++) {
      const out = letters.map((row) => row.slice());
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (out[r][c]) continue;
        const x = rng();
        out[r][c] = level === 3 && x < 0.55 ? fromWords[Math.floor(rng() * fromWords.length)]
          : x > 0.95 ? FINALS[Math.floor(rng() * FINALS.length)]
            : LETTERS[Math.floor(rng() * LETTERS.length)];
      }
      if (placements.every((p) => countOccurrences(out, p.word) === 1)) return { size: n, letters: out, placements };
    }
  }
  throw new Error('could not build a word grid');
}

const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** The placement the child selected (from either end), if any. */
export function matchSelection(grid: WordGrid, a: Cell, b: Cell): Placement | undefined {
  return grid.placements.find((p) => (same(p.start, a) && same(p.end, b)) || (same(p.start, b) && same(p.end, a)));
}
