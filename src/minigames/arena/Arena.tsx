import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../core/store';
import type { ArenaStat } from '../../data/db';
import { newStrategy, updateStrategy } from '../../brain/model';
import type { StrategyId } from '../../brain/types';
import { g, makeRng } from '../../core/rng';
import { sfx } from '../../core/audio';
import {
  tttAiMove, tttFull, tttWinner, tttWinningMove, type TttBoard,
  c4AiMove, c4Drop, c4Empty, c4Valid, c4Winner, c4WinningCol, C4_COLS, type C4Board,
  hanoiCanMove, hanoiHint, hanoiMove, hanoiOptimal, hanoiSolved, hanoiStart, type Pegs,
} from './engines';

type GameId = 'ttt' | 'c4' | 'hanoi';
type Result = 'win' | 'loss' | 'draw';
const rng = makeRng((Date.now() ^ 0x5eed) >>> 0);

const GAMES: { id: GameId; name: string; emoji: string; strategy: string; desc: string }[] = [
  { id: 'ttt', name: 'איקס עיגול', emoji: '❌⭕', strategy: 'לזהות איום 🛡️', desc: 'שלושה בשורה. לפני כל מהלך בודקים: יש ליריב שניים בשורה?' },
  { id: 'c4', name: 'ארבע בשורה', emoji: '🔴🟡', strategy: 'לחשוב צעד קדימה 🔮', desc: 'מפילים דיסקיות. מי שמחבר ארבע ראשון מנצח.' },
  { id: 'hanoi', name: 'מגדלי האנוי', emoji: '🗼', strategy: 'לעבוד מהסוף להתחלה ⏪', desc: 'מעבירים את המגדל לעמוד הימני. דיסק גדול לא יושב על קטן.' },
];
const LEVEL_NAME = ['', 'מתחילים', 'מתקדמים', 'אלופים'];
const newStat = (): ArenaStat => ({ level: 1, wins: 0, losses: 0, draws: 0, lossStreak: 0, winStreak: 0 });

/** Records a strategy observation from real play (a missed block counts as a miss on "spot_threat"). */
function useStrategyLog() {
  const { updatePlayer } = useApp();
  return (id: StrategyId, correct: boolean) =>
    updatePlayer((p) => ({ ...p, strategies: { ...p.strategies, [id]: updateStrategy(p.strategies[id] ?? newStrategy(id), 0, correct) } }));
}

export function Arena({ onExit }: { onExit: () => void }) {
  const { player, updatePlayer, showToast } = useApp();
  const [game, setGame] = useState<GameId | null>(null);
  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const stat = (id: GameId) => p.arena?.[id] ?? newStat();

  /** Adaptive level: two wins in a row → up, three losses in a row → down. Coins reward the level reached. */
  const finish = (id: GameId, result: Result, extra: { coins?: number; best?: number } = {}) => {
    const s = { ...stat(id) };
    let msg = '';
    if (result === 'win') { s.wins++; s.winStreak++; s.lossStreak = 0; }
    else if (result === 'loss') { s.losses++; s.lossStreak++; s.winStreak = 0; }
    else { s.draws++; s.winStreak = 0; s.lossStreak = 0; }
    if (s.winStreak >= 2 && s.level < 3) { s.level++; s.winStreak = 0; msg = G(`⬆️ עלית לרמת ${LEVEL_NAME[s.level]}!`); }
    if (s.lossStreak >= 3 && s.level > 1) { s.level--; s.lossStreak = 0; msg = 'נתאמן רגע ברמה קלה יותר, ואז נחזור.'; }
    if (extra.best !== undefined) s.best = s.best === undefined ? extra.best : Math.min(s.best, extra.best);
    const coins = extra.coins ?? (result === 'win' ? 3 * stat(id).level : result === 'draw' ? stat(id).level : 0);
    updatePlayer((pl) => ({ ...pl, coins: pl.coins + coins, arena: { ...(pl.arena ?? {}), [id]: s } }));
    if (coins) setTimeout(sfx.coin, 200);
    if (msg) showToast(msg);
    return coins;
  };

  return (
    <div className="screen mines world-arena">
      <div className="mine-top">
        <button className="btn btn-ghost btn-sm" onClick={game ? () => setGame(null) : onExit}>{game ? '← לזירה' : '🏝️ חזרה לאי'}</button>
        <h2 className="mine-title">♟️ ארנה החשיבה</h2>
        <span className="coins">🪙 {p.coins}</span>
      </div>
      {!game && (
        <div className="arena-list">
          {GAMES.map((gm) => {
            const s = stat(gm.id);
            return (
              <button key={gm.id} className="card arena-card" onClick={() => { sfx.tap(); setGame(gm.id); }}>
                <span className="arena-emoji">{gm.emoji}</span>
                <b>{gm.name}</b>
                <span className="muted small">{gm.desc}</span>
                <span className="tag">אסטרטגיה: {gm.strategy}</span>
                <span className="small">רמה: {'⭐'.repeat(s.level)}{'☆'.repeat(3 - s.level)} {LEVEL_NAME[s.level]} · ניצחונות: {s.wins}</span>
              </button>
            );
          })}
        </div>
      )}
      {game === 'ttt' && <TicTacToe level={stat('ttt').level} onEnd={(r) => finish('ttt', r)} />}
      {game === 'c4' && <ConnectFour level={stat('c4').level} onEnd={(r) => finish('c4', r)} />}
      {game === 'hanoi' && <Hanoi level={stat('hanoi').level} best={stat('hanoi').best} onEnd={(r, moves, n) => finish('hanoi', r, { best: moves, coins: r === 'win' ? 5 * (n - 2) : 1 })} />}
    </div>
  );
}

function EndBar({ result, coins, onAgain, text }: { result: Result; coins: number; onAgain: () => void; text: string }) {
  return (
    <div className={`feedback ${result === 'win' ? 'solved' : result === 'draw' ? 'retry' : 'revealed'}`}>
      <b>{result === 'win' ? '🏆 ניצחון!' : result === 'draw' ? '🤝 תיקו!' : '💪 הפעם המחשב ניצח.'}</b> {text}
      {coins > 0 && <> +🪙 {coins}</>}
      <div className="row"><button className="btn btn-yellow" onClick={onAgain}>עוד משחק</button></div>
    </div>
  );
}

// ---------------- Tic-tac-toe ----------------

function TicTacToe({ level, onEnd }: { level: number; onEnd: (r: Result) => number }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const log = useStrategyLog();
  const [round, setRound] = useState(0);
  const [b, setB] = useState<TttBoard>(() => Array(9).fill(0));
  const [busy, setBusy] = useState(false);
  const [coach, setCoach] = useState('');
  const [hint, setHint] = useState(-1);
  const [end, setEnd] = useState<{ result: Result; coins: number; text: string } | null>(null);
  const missedBlock = useRef(false);

  const aiStarts = round % 2 === 1;
  useEffect(() => {
    const nb = Array(9).fill(0);
    if (aiStarts) nb[tttAiMove(nb, level, rng)] = 2;
    setB(nb); setEnd(null); setCoach(''); setHint(-1); missedBlock.current = false;
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const conclude = (board: TttBoard) => {
    const w = tttWinner(board);
    if (!w && !tttFull(board)) return false;
    const result: Result = !w ? 'draw' : w.who === 1 ? 'win' : 'loss';
    const text = result === 'loss' && missedBlock.current
      ? G('ליריב היו שניים בשורה ולא חסמת. בפעם הבאה: לפני כל מהלך, בד{וק|קי} את השורות שלו. 🛡️')
      : result === 'draw' ? 'אף אחד לא נפל בפח. זה משחק של שני חושבים טובים.'
      : result === 'win' ? G('ראית את ההזדמנות וניצלת אותה.') : 'נסו לחשוב איפה המחשב יכול לסגור שורה.';
    if (result === 'win') sfx.win(); else if (result === 'loss') sfx.wrong();
    setEnd({ result, coins: onEnd(result), text });
    return true;
  };

  const play = (i: number) => {
    if (busy || end || b[i]) return;
    const own = tttWinningMove(b, 1);
    const threat = tttWinningMove(b, 2);
    if (own >= 0) log('think_ahead', i === own);
    else if (threat >= 0) {
      log('spot_threat', i === threat);
      if (i !== threat) missedBlock.current = true;
    }
    const nb = [...b]; nb[i] = 1; sfx.tap();
    setB(nb); setHint(-1); setCoach('');
    if (conclude(nb)) return;
    setBusy(true);
    setTimeout(() => {
      const ai = [...nb]; ai[tttAiMove(ai, level, rng)] = 2;
      setB(ai); setBusy(false);
      conclude(ai);
    }, 450);
  };

  const giveHint = () => {
    const own = tttWinningMove(b, 1);
    const threat = tttWinningMove(b, 2);
    if (own >= 0) { setHint(own); setCoach(G('🔮 יש לך מהלך מנצח! חפש{|י} שורה שבה חסר לך רק סימן אחד.')); }
    else if (threat >= 0) { setHint(threat); setCoach('🛡️ זהירות! ליריב יש שניים בשורה. איפה חוסמים?'); }
    else if (b[4] === 0) { setHint(4); setCoach('💡 המרכז שייך לארבע שורות. זה המקום החזק ביותר.'); }
    else { setCoach('💡 פינות שייכות לשלוש שורות. נסו לתפוס פינה.'); }
  };

  return (
    <div className="card game-card">
      <p className="muted center">{aiStarts ? 'המחשב פותח.' : G('את{ה|} פותח{|ת}.')} {G('את{ה|}')} ❌, המחשב ⭕. רמה: {LEVEL_NAME[level]}</p>
      <div className="ttt" dir="ltr">
        {b.map((c, i) => (
          <button key={i} className={`ttt-cell ${hint === i ? 'hint' : ''}`} onClick={() => play(i)} aria-label={`משבצת ${i + 1}`}>
            {c === 1 ? '❌' : c === 2 ? '⭕' : ''}
          </button>
        ))}
      </div>
      {coach && <p className="coach-line">{coach}</p>}
      {end ? <EndBar {...end} onAgain={() => setRound((r) => r + 1)} /> : (
        <div className="row"><button className="btn btn-ghost" onClick={giveHint} disabled={busy}>💡 רמז</button></div>
      )}
    </div>
  );
}

// ---------------- Connect four ----------------

function ConnectFour({ level, onEnd }: { level: number; onEnd: (r: Result) => number }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const log = useStrategyLog();
  const [round, setRound] = useState(0);
  const [b, setB] = useState<C4Board>(c4Empty);
  const [busy, setBusy] = useState(false);
  const [coach, setCoach] = useState('');
  const [hintCol, setHintCol] = useState(-1);
  const [end, setEnd] = useState<{ result: Result; coins: number; text: string } | null>(null);
  const [winCells, setWinCells] = useState<string[]>([]);
  const missedBlock = useRef(false);

  useEffect(() => {
    setB(c4Empty()); setEnd(null); setCoach(''); setHintCol(-1); setWinCells([]); missedBlock.current = false;
  }, [round]);

  const conclude = (board: C4Board) => {
    const w = c4Winner(board);
    if (!w && c4Valid(board).length) return false;
    if (w) setWinCells(w.cells.map(([r, c]) => `${r}-${c}`));
    const result: Result = !w ? 'draw' : w.who === 1 ? 'win' : 'loss';
    const text = result === 'loss' && missedBlock.current
      ? G('למחשב היו שלוש בשורה ולא חסמת. לפני כל מהלך: בד{וק|קי} אם הוא יכול לנצח בתור הבא. 🛡️')
      : result === 'win' ? G('חיברת ארבע! תכננת קדימה.') : result === 'draw' ? 'הלוח התמלא. משחק צמוד!' : 'חשבו איפה המחשב בנה שורה ארוכה.';
    if (result === 'win') sfx.win(); else if (result === 'loss') sfx.wrong();
    setEnd({ result, coins: onEnd(result), text });
    return true;
  };

  const play = (col: number) => {
    if (busy || end || b[0][col] !== 0) return;
    const own = c4WinningCol(b, 1);
    const threat = c4WinningCol(b, 2);
    if (own >= 0) log('think_ahead', col === own);
    else if (threat >= 0) {
      log('spot_threat', col === threat);
      if (col !== threat) missedBlock.current = true;
    }
    const nb = b.map((r) => [...r]);
    c4Drop(nb, col, 1); sfx.tap();
    setB(nb); setHintCol(-1); setCoach('');
    if (conclude(nb)) return;
    setBusy(true);
    setTimeout(() => {
      const ai = nb.map((r) => [...r]);
      c4Drop(ai, c4AiMove(ai, level, rng), 2);
      setB(ai); setBusy(false);
      conclude(ai);
    }, 450);
  };

  const giveHint = () => {
    const own = c4WinningCol(b, 1);
    const threat = c4WinningCol(b, 2);
    if (own >= 0) { setHintCol(own); setCoach('🔮 יש מהלך מנצח! חפשו שלוש בשורה עם מקום פנוי.'); }
    else if (threat >= 0) { setHintCol(threat); setCoach('🛡️ למחשב יש שלוש בשורה! חוסמים עכשיו.'); }
    else { setHintCol(3); setCoach('💡 העמודה האמצעית שייכת להכי הרבה שורות. היא חזקה.'); }
  };

  return (
    <div className="card game-card">
      <p className="muted center">🔴 שלך, 🟡 של המחשב. לוחצים על עמודה. רמה: {LEVEL_NAME[level]}</p>
      <div className="c4" dir="ltr" style={{ gridTemplateColumns: `repeat(${C4_COLS}, 1fr)` }}>
        {b.map((row, r) => row.map((c, col) => (
          <button key={`${r}-${col}`} className={`c4-cell ${hintCol === col ? 'hint' : ''} ${winCells.includes(`${r}-${col}`) ? 'win' : ''}`} onClick={() => play(col)} aria-label={`עמודה ${col + 1}`}>
            <span className={`disc d${c}`} />
          </button>
        )))}
      </div>
      {coach && <p className="coach-line">{coach}</p>}
      {end ? <EndBar {...end} onAgain={() => setRound((r) => r + 1)} /> : (
        <div className="row"><button className="btn btn-ghost" onClick={giveHint} disabled={busy}>💡 רמז</button></div>
      )}
    </div>
  );
}

// ---------------- Towers of Hanoi ----------------

function Hanoi({ level, best, onEnd }: { level: number; best?: number; onEnd: (r: Result, moves: number, n: number) => number }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const log = useStrategyLog();
  const n = level + 2;
  const [round, setRound] = useState(0);
  const [pegs, setPegs] = useState<Pegs>(() => hanoiStart(n));
  const [sel, setSel] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [coach, setCoach] = useState('');
  const [hintMove, setHintMove] = useState<[number, number] | null>(null);
  const [end, setEnd] = useState<{ result: Result; coins: number; text: string } | null>(null);
  const hintsUsed = useRef(0);

  useEffect(() => { setPegs(hanoiStart(n)); setSel(null); setMoves(0); setCoach(''); setEnd(null); setHintMove(null); hintsUsed.current = 0; }, [round, n]);

  const tap = (i: number) => {
    if (end) return;
    if (sel === null) { if (pegs[i].length) { setSel(i); sfx.tap(); } return; }
    if (sel === i) { setSel(null); return; }
    if (!hanoiCanMove(pegs, sel, i)) { sfx.wrong(); setCoach('דיסק גדול לא יכול לשבת על דיסק קטן יותר.'); setSel(null); return; }
    const next = hanoiMove(pegs, sel, i);
    const m = moves + 1;
    setPegs(next); setMoves(m); setSel(null); setCoach(''); setHintMove(null); sfx.tap();
    if (hanoiSolved(next, n)) {
      const optimal = m === hanoiOptimal(n);
      log('work_backwards', optimal && hintsUsed.current === 0);
      sfx.win();
      const text = optimal
        ? G(`מספר המהלכים הכי קטן שאפשר: ${m}! חשבת מהסוף להתחלה.`)
        : `הצלחה! מספר המהלכים: ${m}. הכי מעט אפשרי: ${hanoiOptimal(n)}. רוצים לנסות שוב?`;
      setEnd({ result: optimal ? 'win' : 'draw', coins: onEnd(optimal ? 'win' : 'draw', m, n), text });
    }
  };

  const giveHint = () => {
    hintsUsed.current++;
    const h = hanoiHint(pegs, n);
    if (!h) return;
    setHintMove(h);
    const biggest = n;
    const onTarget = pegs[2].includes(biggest);
    setCoach(onTarget
      ? '⏪ הדיסק הגדול כבר במקום. עכשיו אותה שאלה עם הדיסק הבא: מה צריך לקרות כדי שהוא יגיע לעמוד הימני?'
      : '⏪ עובדים מהסוף: כדי שהדיסק הגדול יעבור לעמוד הימני, כל השאר צריכים לחכות בעמוד האמצעי.');
  };

  return (
    <div className="card game-card">
      <p className="muted center">{n} דיסקים · מהלכים: {moves} · הכי מעט אפשרי: {hanoiOptimal(n)}{best !== undefined ? ` · השיא שלך: ${best}` : ''}</p>
      <div className="hanoi" dir="ltr">
        {pegs.map((peg, i) => (
          <button key={i} className={`peg ${sel === i ? 'sel' : ''} ${hintMove?.[0] === i ? 'hint-from' : ''} ${hintMove?.[1] === i ? 'hint-to' : ''}`} onClick={() => tap(i)} aria-label={`עמוד ${i + 1}`}>
            <span className="pole" />
            <span className="stack">
              {[...peg].reverse().map((d) => (
                <span key={d} className="disk" style={{ width: `${30 + (d / n) * 65}%`, background: `var(--c${(d % 6) + 1})` }} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <p className="muted small center">לוחצים על עמוד כדי להרים את הדיסק העליון, ועל עמוד אחר כדי להניח אותו. היעד: העמוד הימני.</p>
      {coach && <p className="coach-line">{coach}</p>}
      {end ? <EndBar {...end} onAgain={() => setRound((r) => r + 1)} /> : (
        <div className="row">
          <button className="btn btn-ghost" onClick={giveHint}>💡 רמז</button>
          <button className="btn btn-ghost" onClick={() => setRound((r) => r + 1)}>↺ מההתחלה</button>
        </div>
      )}
    </div>
  );
}
