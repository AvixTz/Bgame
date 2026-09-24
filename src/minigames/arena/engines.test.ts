import { describe, expect, it } from 'vitest';
import { makeRng } from '../../core/rng';
import {
  tttAiMove, tttWinner, tttFull, c4Empty, c4Drop, c4AiMove, c4Winner, c4WinningCol, C4_COLS,
  hanoiStart, hanoiHint, hanoiMove, hanoiSolved, hanoiCanMove, hanoiOptimal,
} from './engines';

describe('tic-tac-toe', () => {
  it('level 3 never loses against a random player', () => {
    const rng = makeRng(1);
    for (let game = 0; game < 80; game++) {
      const b = Array(9).fill(0);
      let turn = game % 2 ? 1 : 2;
      while (!tttWinner(b) && !tttFull(b)) {
        if (turn === 1) {
          const free = b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
          b[free[Math.floor(rng() * free.length)]] = 1;
        } else b[tttAiMove(b, 3, rng)] = 2;
        turn = turn === 1 ? 2 : 1;
      }
      expect(tttWinner(b)?.who).not.toBe(1);
    }
  });
  it('level 2 blocks an immediate threat', () => {
    const b = [1, 1, 0, 0, 2, 0, 0, 0, 0];
    expect(tttAiMove(b, 2, makeRng(2))).toBe(2);
  });
});

describe('connect four', () => {
  it('detects wins for either player and blocks (regression for the original global-turn bug)', () => {
    const b = c4Empty();
    c4Drop(b, 0, 1); c4Drop(b, 1, 1); c4Drop(b, 2, 1);
    expect(c4WinningCol(b, 1)).toBe(3);
    expect(c4AiMove(b, 2, makeRng(3))).toBe(3);
    c4Drop(b, 3, 1);
    expect(c4Winner(b)?.who).toBe(1);
  });
  it('level 3 beats a random player most of the time', () => {
    const rng = makeRng(4);
    let aiWins = 0;
    for (let game = 0; game < 20; game++) {
      const b = c4Empty();
      let turn = 1;
      for (let m = 0; m < 42 && !c4Winner(b); m++) {
        const valid = [...Array(C4_COLS).keys()].filter((c) => b[0][c] === 0);
        if (!valid.length) break;
        const col = turn === 1 ? valid[Math.floor(rng() * valid.length)] : c4AiMove(b, 3, rng);
        c4Drop(b, col, turn);
        turn = turn === 1 ? 2 : 1;
      }
      if (c4Winner(b)?.who === 2) aiWins++;
    }
    expect(aiWins).toBeGreaterThanOrEqual(18);
  });
});

describe('hanoi', () => {
  it('following hints solves in the optimal number of moves', () => {
    for (const n of [3, 4, 5]) {
      let p = hanoiStart(n);
      let moves = 0;
      while (!hanoiSolved(p, n)) {
        const h = hanoiHint(p, n)!;
        expect(hanoiCanMove(p, h[0], h[1])).toBe(true);
        p = hanoiMove(p, h[0], h[1]);
        moves++;
      }
      expect(moves).toBe(hanoiOptimal(n));
    }
  });
  it('hint recovers from a detour', () => {
    let p = hanoiStart(3);
    p = hanoiMove(p, 0, 1);
    p = hanoiMove(p, 1, 0);
    let moves = 0;
    while (!hanoiSolved(p, 3) && moves < 20) { const h = hanoiHint(p, 3)!; p = hanoiMove(p, h[0], h[1]); moves++; }
    expect(hanoiSolved(p, 3)).toBe(true);
  });
});
