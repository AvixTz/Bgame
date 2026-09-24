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
        } else b[tttAiMove(b, 3)] = 2;
        turn = turn === 1 ? 2 : 1;
      }
      expect(tttWinner(b)?.who).not.toBe(1);
    }
  });
  it('level 2 blocks an immediate threat', () => {
    const b = [1, 1, 0, 0, 2, 0, 0, 0, 0];
    expect(tttAiMove(b, 2)).toBe(2);
  });
});

describe('connect four', () => {
  it('detects wins for either player and blocks (regression for the original global-turn bug)', () => {
    const b = c4Empty();
    c4Drop(b, 0, 1); c4Drop(b, 1, 1); c4Drop(b, 2, 1);
    expect(c4WinningCol(b, 1)).toBe(3);
    expect(c4AiMove(b, 2)).toBe(3);
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
        const col = turn === 1 ? valid[Math.floor(rng() * valid.length)] : c4AiMove(b, 3);
        c4Drop(b, col, turn);
        turn = turn === 1 ? 2 : 1;
      }
      if (c4Winner(b)?.who === 2) aiWins++;
    }
    expect(aiWins).toBeGreaterThanOrEqual(19);
  }, 120000);
});

describe('rule-based levels', () => {
  it('every level is deterministic: same board, same move', () => {
    const rng = makeRng(21);
    for (let k = 0; k < 40; k++) {
      const b = Array(9).fill(0);
      for (let m = 0; m < 3; m++) { const f = b.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0); b[f[Math.floor(rng() * f.length)]] = m % 2 ? 2 : 1; }
      if (tttWinner(b)) continue;
      for (const lvl of [1, 2, 3]) expect(tttAiMove([...b], lvl)).toBe(tttAiMove([...b], lvl));
    }
    const c = c4Empty(); c4Drop(c, 3, 1); c4Drop(c, 2, 2); c4Drop(c, 4, 1);
    for (const lvl of [1, 2, 3]) expect(c4AiMove(c.map((r) => [...r]), lvl)).toBe(c4AiMove(c.map((r) => [...r]), lvl));
  });
  it('level 1 tic-tac-toe does not block, level 2 does', () => {
    const b = [1, 1, 0, 0, 0, 0, 0, 0, 0];
    expect(tttAiMove([...b], 1)).not.toBe(2);
    expect(tttAiMove([...b], 2)).toBe(2);
  });
  it('level 3 tic-tac-toe never loses to any line of play (exhaustive)', () => {
    let losses = 0;
    const play = (b: number[]) => {
      if (tttWinner(b)) { if (tttWinner(b)!.who === 1) losses++; return; }
      if (tttFull(b)) return;
      for (let i = 0; i < 9; i++) {
        if (b[i]) continue;
        const nb = [...b]; nb[i] = 1;
        if (tttWinner(nb) || tttFull(nb)) { play(nb); continue; }
        nb[tttAiMove([...nb], 3)] = 2;
        play(nb);
      }
    };
    play(Array(9).fill(0));
    expect(losses).toBe(0);
  });
  it('connect four levels get stronger: level 3 (opening) beats level 1 and level 2', () => {
    for (const weak of [1, 2]) {
      const b = c4Empty();
      let turn = 2;
      for (let m = 0; m < 42 && !c4Winner(b); m++) {
        if (!b[0].some((x) => x === 0)) break;
        // The weak engine plays as "1": give it a mirrored board so it thinks it is the computer.
        const mirror = b.map((r) => r.map((x) => (x ? 3 - x : 0)));
        const col = turn === 1 ? c4AiMove(mirror, weak) : c4AiMove(b, 3);
        c4Drop(b, col, turn);
        turn = 3 - turn;
      }
      expect(c4Winner(b)?.who).toBe(2);
    }
  }, 120000);
  it('connect four level 3 answers in reasonable time', () => {
    const b = c4Empty(); c4Drop(b, 3, 1);
    const t = performance.now();
    c4AiMove(b, 3);
    expect(performance.now() - t).toBeLessThan(2500);
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
