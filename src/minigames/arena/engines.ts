import type { Rng } from '../../core/rng';

// ---------------- Tic-tac-toe ----------------
// Cells 0..8, values: 0 empty, 1 child, 2 computer.

export type TttBoard = number[];
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function tttWinner(b: TttBoard): { who: number; line: number[] } | null {
  for (const l of LINES) {
    const [a, c, d] = l;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: l };
  }
  return null;
}
export const tttFull = (b: TttBoard) => b.every((c) => c !== 0);
const empties = (b: TttBoard) => b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);

/** A cell where `who` wins immediately, or -1. */
export function tttWinningMove(b: TttBoard, who: number): number {
  for (const i of empties(b)) {
    b[i] = who;
    const w = tttWinner(b);
    b[i] = 0;
    if (w) return i;
  }
  return -1;
}

function minimax(b: TttBoard, turn: number, depth: number): number {
  const w = tttWinner(b);
  if (w) return w.who === 2 ? 10 - depth : depth - 10;
  if (tttFull(b)) return 0;
  let best = turn === 2 ? -Infinity : Infinity;
  for (const i of empties(b)) {
    b[i] = turn;
    const v = minimax(b, turn === 2 ? 1 : 2, depth + 1);
    b[i] = 0;
    best = turn === 2 ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

/** Level 1: mostly random. Level 2: wins and blocks. Level 3: perfect play. */
export function tttAiMove(b: TttBoard, level: number, rng: Rng): number {
  const free = empties(b);
  const win = tttWinningMove(b, 2);
  const block = tttWinningMove(b, 1);
  if (level === 1) {
    if (win >= 0 && rng() < 0.5) return win;
    return free[Math.floor(rng() * free.length)];
  }
  if (win >= 0) return win;
  if (block >= 0) return block;
  if (level === 2) {
    if (b[4] === 0 && rng() < 0.5) return 4;
    return free[Math.floor(rng() * free.length)];
  }
  // Opening: any corner or the center is optimal; skip the full search.
  if (free.length >= 8) {
    const openings = [0, 2, 4, 6, 8].filter((i) => b[i] === 0);
    if (free.length === 9 || b[4] !== 0) return openings[Math.floor(rng() * openings.length)];
    return 4;
  }
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of free) {
    b[i] = 2;
    const v = minimax(b, 1, 1);
    b[i] = 0;
    if (v > best) { best = v; moves = [i]; } else if (v === best) moves.push(i);
  }
  return moves[Math.floor(rng() * moves.length)];
}

// ---------------- Connect four ----------------
// Board [row][col], row 0 is the top. 0 empty, 1 child, 2 computer.

export const C4_ROWS = 6;
export const C4_COLS = 7;
export type C4Board = number[][];
export const c4Empty = (): C4Board => Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0));

export function c4Drop(b: C4Board, col: number, who: number): number {
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (b[r][col] === 0) { b[r][col] = who; return r; }
  }
  return -1;
}
function c4Undo(b: C4Board, col: number) {
  for (let r = 0; r < C4_ROWS; r++) if (b[r][col] !== 0) { b[r][col] = 0; return; }
}
export const c4Valid = (b: C4Board) => [...Array(C4_COLS).keys()].filter((c) => b[0][c] === 0);

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
/** Winner check that looks at the actual cell owner (the original Games version compared to a global turn and missed blocks). */
export function c4Winner(b: C4Board): { who: number; cells: [number, number][] } | null {
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const who = b[r][c];
      if (!who) continue;
      for (const [dr, dc] of DIRS) {
        const cells: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS || b[rr][cc] !== who) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return { who, cells };
      }
    }
  }
  return null;
}

export function c4WinningCol(b: C4Board, who: number): number {
  for (const c of c4Valid(b)) {
    c4Drop(b, c, who);
    const w = c4Winner(b);
    c4Undo(b, c);
    if (w?.who === who) return c;
  }
  return -1;
}

function scoreWindow(w: number[]): number {
  const me = w.filter((x) => x === 2).length, op = w.filter((x) => x === 1).length, empty = w.filter((x) => x === 0).length;
  if (me === 4) return 1000;
  if (me === 3 && empty === 1) return 6;
  if (me === 2 && empty === 2) return 2;
  if (op === 3 && empty === 1) return -8;
  if (op === 2 && empty === 2) return -1;
  return 0;
}
function evaluate(b: C4Board): number {
  let s = 0;
  for (let r = 0; r < C4_ROWS; r++) if (b[r][3] === 2) s += 3;
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const w: number[] = [];
        for (let k = 0; k < 4; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS) break;
          w.push(b[rr][cc]);
        }
        if (w.length === 4) s += scoreWindow(w);
      }
    }
  }
  return s;
}
function negamax(b: C4Board, depth: number, alpha: number, beta: number, who: number): number {
  const w = c4Winner(b);
  if (w) return (w.who === who ? 1 : -1) * (100000 + depth);
  const valid = c4Valid(b);
  if (!valid.length) return 0;
  if (depth === 0) return (who === 2 ? 1 : -1) * evaluate(b);
  let best = -Infinity;
  for (const c of [3, 2, 4, 1, 5, 0, 6].filter((x) => valid.includes(x))) {
    c4Drop(b, c, who);
    const v = -negamax(b, depth - 1, -beta, -alpha, who === 2 ? 1 : 2);
    c4Undo(b, c);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export function c4AiMove(b: C4Board, level: number, rng: Rng): number {
  const valid = c4Valid(b);
  const win = c4WinningCol(b, 2);
  const block = c4WinningCol(b, 1);
  if (level === 1) {
    if (win >= 0 && rng() < 0.6) return win;
    if (block >= 0 && rng() < 0.3) return block;
    return valid[Math.floor(rng() * valid.length)];
  }
  if (win >= 0) return win;
  if (block >= 0) return block;
  const depth = level === 2 ? 2 : 5;
  let best = -Infinity;
  let moves: number[] = [];
  for (const c of valid) {
    c4Drop(b, c, 2);
    const v = -negamax(b, depth - 1, -Infinity, Infinity, 1);
    c4Undo(b, c);
    if (v > best) { best = v; moves = [c]; } else if (v === best) moves.push(c);
  }
  return moves[Math.floor(rng() * moves.length)];
}

// ---------------- Towers of Hanoi ----------------

export type Pegs = [number[], number[], number[]];
export const hanoiStart = (n: number): Pegs => [Array.from({ length: n }, (_, i) => n - i), [], []];
export const hanoiOptimal = (n: number) => 2 ** n - 1;
export function hanoiCanMove(p: Pegs, from: number, to: number): boolean {
  if (from === to || !p[from].length) return false;
  const disk = p[from][p[from].length - 1];
  const top = p[to][p[to].length - 1];
  return top === undefined || disk < top;
}
export function hanoiMove(p: Pegs, from: number, to: number): Pegs {
  const next = p.map((x) => [...x]) as Pegs;
  next[to].push(next[from].pop()!);
  return next;
}
export const hanoiSolved = (p: Pegs, n: number) => p[2].length === n;

/** The next move of the optimal solution from the current position (for hints), or null. */
export function hanoiHint(p: Pegs, n: number): [number, number] | null {
  // Find where each disk should go: recursively, disk k must end on the target peg.
  const pos: number[] = [];
  p.forEach((peg, i) => peg.forEach((d) => { pos[d] = i; }));
  function solve(k: number, target: number): [number, number] | null {
    if (k === 0) return null;
    if (pos[k] === target) return solve(k - 1, target);
    const other = 3 - pos[k] - target;
    return solve(k - 1, other) ?? [pos[k], target];
  }
  return solve(n, 2);
}
