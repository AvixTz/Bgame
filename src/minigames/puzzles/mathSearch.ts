/**
 * Exercise search (תפזורת תרגילים). A board of numbers with arithmetic signs between them:
 *
 *   n op n op n ...      even row: numbers in even columns, signs between them
 *   op    op    ...      odd row: signs under the numbers (for exercises read top to bottom)
 *
 * An exercise is five cells in a row, left to right, or in a column, top to bottom:
 * number, sign, number, sign, number, with exactly one "=". The child looks for the exercises that
 * are correct (both "7 + 5 = 12" and "12 = 7 + 5" count). Levels follow fixed rules:
 *   1: 4x4 numbers, + and - up to 20, 4 planted exercises.
 *   2: 5x5 numbers, + and - up to 100, 5 planted exercises and 3 wrong ones off by 1 or 10.
 *   3: 6x6 numbers, + - and x (times tables), 6 planted and 6 wrong ones that look right
 *      (off by 1 or 10, or the result of a different sign). No hints.
 * Every correct exercise on the board counts, including ones that formed by chance.
 */
import { shuffle, type Rng } from '../../core/rng';

export type Op = '+' | '-' | '×' | '=';
export type Token = { kind: 'num'; value: number } | { kind: 'op'; op: Op } | { kind: 'blank' };
export type Cell = [number, number];
export interface Exercise { cells: Cell[]; text: string }
export interface MathGrid { rows: number; cols: number; tokens: Token[][]; correct: Exercise[] }

export const MS_LEVELS = {
  1: { n: 4, ops: ['+', '-'] as Op[], max: 20, plant: 4, decoys: 0 },
  2: { n: 5, ops: ['+', '-'] as Op[], max: 100, plant: 5, decoys: 3 },
  3: { n: 6, ops: ['+', '-', '×'] as Op[], max: 100, plant: 6, decoys: 6 },
} as const;

export const MS_RULES: Record<number, string[]> = {
  1: ['לוח של 4 על 4 מספרים', 'חיבור וחיסור עד 20', 'תרגילים משמאל לימין או מלמעלה למטה', 'יש רמזים'],
  2: ['לוח של 5 על 5 מספרים', 'חיבור וחיסור עד 100', 'יש גם תרגילים שגויים: צריך לבדוק כל אחד', 'יש רמזים'],
  3: ['לוח של 6 על 6 מספרים', 'חיבור, חיסור וכפל', 'הרבה תרגילים שגויים שנראים נכונים', 'בלי רמזים'],
};

const OP_TEXT: Record<Op, string> = { '+': '+', '-': '−', '×': '×', '=': '=' };
export const opText = (op: Op) => OP_TEXT[op];

const apply = (a: number, op: Op, b: number) => (op === '+' ? a + b : op === '-' ? a - b : a * b);

/** Value of a 5-token exercise if it is a true equation with exactly one "=", else null. */
export function isCorrect(t: Token[]): boolean {
  if (t.length !== 5 || t[0].kind !== 'num' || t[1].kind !== 'op' || t[2].kind !== 'num' || t[3].kind !== 'op' || t[4].kind !== 'num') return false;
  const [a, o1, b, o2, c] = [t[0].value, t[1].op, t[2].value, t[3].op, t[4].value];
  if ((o1 === '=') === (o2 === '=')) return false;
  return o2 === '=' ? apply(a, o1, b) === c : a === apply(b, o2, c);
}

const tokenText = (t: Token) => (t.kind === 'num' ? String(t.value) : t.kind === 'op' ? OP_TEXT[t.op] : '');

/** All exercise slots: 5 cells starting on a number, to the right or downward. */
function slots(rows: number, cols: number): Cell[][] {
  const out: Cell[][] = [];
  for (let r = 0; r < rows; r += 2) for (let c = 0; c + 4 < cols; c += 2) out.push([0, 1, 2, 3, 4].map((i) => [r, c + i] as Cell));
  for (let c = 0; c < cols; c += 2) for (let r = 0; r + 4 < rows; r += 2) out.push([0, 1, 2, 3, 4].map((i) => [r + i, c] as Cell));
  return out;
}

function randomExercise(level: 1 | 2 | 3, rng: Rng): [number, Op, number, number] {
  const cfg = MS_LEVELS[level];
  const op = cfg.ops[Math.floor(rng() * cfg.ops.length)];
  const r = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  if (op === '×') { const a = r(2, 9), b = r(2, 9); return [a, op, b, a * b]; }
  if (op === '+') { const c = r(level === 1 ? 5 : 20, cfg.max); const a = r(1, c - 1); return [a, op, c - a, c]; }
  const a = r(level === 1 ? 5 : 20, cfg.max); const b = r(1, a - 1); return [a, op, b, a - b];
}

/** A wrong result that looks plausible: off by 1 or 10, or what another sign would give. */
function wrongResult(a: number, op: Op, b: number, c: number, rng: Rng): number {
  const options = [c + 1, c - 1, c + 10, c - 10, a + b, Math.abs(a - b), a * b].filter((x) => x !== c && x >= 0 && x <= 100);
  return options[Math.floor(rng() * options.length)];
}

export function makeMathGrid(level: 1 | 2 | 3, rng: Rng): MathGrid {
  const cfg = MS_LEVELS[level];
  const rows = cfg.n * 2 - 1, cols = cfg.n * 2 - 1;
  for (let attempt = 0; attempt < 60; attempt++) {
    const tokens: (Token | null)[][] = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (r % 2 && c % 2 ? { kind: 'blank' } as Token : null)));
    const place = (cells: Cell[], vals: Token[]) => {
      if (!cells.every(([r, c], i) => {
        const t = tokens[r][c];
        if (!t) return true;
        const v = vals[i];
        return t.kind === 'num' && v.kind === 'num' ? t.value === v.value : t.kind === 'op' && v.kind === 'op' && t.op === v.op;
      })) return false;
      cells.forEach(([r, c], i) => { tokens[r][c] = vals[i]; });
      return true;
    };
    const free = shuffle(rng, slots(rows, cols));
    let planted = 0, decoys = 0;
    for (const cells of free) {
      if (planted >= cfg.plant && decoys >= cfg.decoys) break;
      const [a, op, b, c] = randomExercise(level, rng);
      const makeDecoy = planted >= cfg.plant || (decoys < cfg.decoys && rng() < 0.4);
      const res = makeDecoy ? wrongResult(a, op, b, c, rng) : c;
      const ok = place(cells, [{ kind: 'num', value: a }, { kind: 'op', op }, { kind: 'num', value: b }, { kind: 'op', op: '=' }, { kind: 'num', value: res }]);
      if (ok) { if (makeDecoy) decoys++; else planted++; }
    }
    if (planted < cfg.plant) continue;
    const full = tokens.map((row) => row.map((t) => t ?? (null as unknown as Token)));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (full[r][c]) continue;
      if (r % 2 === 0 && c % 2 === 0) {
        full[r][c] = { kind: 'num', value: 1 + Math.floor(rng() * (level === 1 ? 20 : 60)) };
      } else {
        const x = rng();
        full[r][c] = { kind: 'op', op: x < 0.2 ? '=' : cfg.ops[Math.floor(rng() * cfg.ops.length)] };
      }
    }
    const correct = slots(rows, cols)
      .filter((cells) => isCorrect(cells.map(([r, c]) => full[r][c])))
      .map((cells) => ({ cells, text: cells.map(([r, c]) => tokenText(full[r][c])).join(' ') }));
    // Keep the board readable: not too many exercises to find.
    if (correct.length > cfg.plant + 3) continue;
    return { rows, cols, tokens: full, correct };
  }
  throw new Error('could not build a math grid');
}

const key = (c: Cell) => `${c[0]},${c[1]}`;

/**
 * Checks a selection from a to b (either end first). Returns the exercise if it is one of the
 * correct ones, "wrong" if it is a well-formed exercise that is not correct, or null if the
 * selection is not an exercise at all (wrong length, diagonal, starts on a sign).
 */
export function checkMathSelection(g: MathGrid, a: Cell, b: Cell): Exercise | 'wrong' | null {
  let [s, e] = [a, b];
  if (s[0] > e[0] || s[1] > e[1]) [s, e] = [e, s];
  const horiz = s[0] === e[0] && e[1] - s[1] === 4;
  const vert = s[1] === e[1] && e[0] - s[0] === 4;
  if (!horiz && !vert) return null;
  const cells = [0, 1, 2, 3, 4].map((i) => (horiz ? [s[0], s[1] + i] : [s[0] + i, s[1]]) as Cell);
  const t = cells.map(([r, c]) => g.tokens[r][c]);
  if (t[0].kind !== 'num' || t[4].kind !== 'num') return null;
  const hit = g.correct.find((x) => key(x.cells[0]) === key(cells[0]) && key(x.cells[4]) === key(cells[4]));
  return hit ?? 'wrong';
}

/** A short, kind explanation of why a selected exercise is not correct ("7 + 5 זה 12"). */
export function explainWrong(g: MathGrid, a: Cell, b: Cell): string | null {
  let [s, e] = [a, b];
  if (s[0] > e[0] || s[1] > e[1]) [s, e] = [e, s];
  const horiz = s[0] === e[0];
  const t = [0, 1, 2, 3, 4].map((i) => (horiz ? g.tokens[s[0]][s[1] + i] : g.tokens[s[0] + i][s[1]]));
  if (t[0].kind !== 'num' || t[1].kind !== 'op' || t[2].kind !== 'num' || t[3].kind !== 'op' || t[4].kind !== 'num') return null;
  const [x, o1, y, o2, z] = [t[0].value, t[1].op, t[2].value, t[3].op, t[4].value];
  if (o1 !== '=' && o2 === '=') return `${x} ${opText(o1)} ${y} זה ${apply(x, o1, y)}, לא ${z}`;
  if (o1 === '=' && o2 !== '=') return `${y} ${opText(o2)} ${z} זה ${apply(y, o2, z)}, לא ${x}`;
  return 'בתרגיל צריך סימן = אחד בדיוק';
}
