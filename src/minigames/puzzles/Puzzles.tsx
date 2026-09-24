import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Calculator, Lightbulb, Puzzle, RotateCcw, Shuffle, Trophy, Type } from 'lucide-react';
import { CoinPill } from '../../ui/Hud';
import { burst, celebrate } from '../../ui/fx';
import { useApp } from '../../core/store';
import type { PuzzleStat } from '../../data/db';
import { g, makeRng } from '../../core/rng';
import { sfx } from '../../core/audio';
import { CATEGORIES } from './wordLists';
import { WS_RULES, makeWordGrid, matchSelection, straightLine, type Cell } from './wordSearch';
import { MS_RULES, checkMathSelection, explainWrong, makeMathGrid, opText } from './mathSearch';

type Kind = 'words' | 'math';
type Level = 1 | 2 | 3;
const LEVEL_NAME = ['', 'מתחילים', 'מתקדמים', 'אלופים'];
const newStat = (): PuzzleStat => ({ level: 1, solved: 0, wonLevels: [], hints: 0, mistakes: 0 });
const k = (c: Cell) => `${c[0]},${c[1]}`;
const FOUND_COLORS = 8;

/** Puzzle Garden: word search by category and exercise search. No timer, by design. */
export function Puzzles({ onExit }: { onExit: () => void }) {
  const { player, updatePlayer } = useApp();
  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const [kind, setKind] = useState<Kind | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const stat = (id: Kind) => ({ ...newStat(), ...(p.puzzles?.[id] ?? {}) });
  const setLevel = (id: Kind, level: number) => updatePlayer((pl) => ({ ...pl, puzzles: { ...(pl.puzzles ?? {}), [id]: { ...stat(id), ...(pl.puzzles?.[id] ?? {}), level } } }));

  const finish = (id: Kind, res: { hints: number; mistakes: number; category?: string }) => {
    const s = stat(id);
    const coins = (id === 'math' ? 3 : 2) * s.level;
    updatePlayer((pl) => {
      const cur = { ...newStat(), ...(pl.puzzles?.[id] ?? {}) };
      const categories = res.category ? { ...(cur.categories ?? {}), [res.category]: (cur.categories?.[res.category] ?? 0) + 1 } : cur.categories;
      return {
        ...pl, coins: pl.coins + coins,
        puzzles: { ...(pl.puzzles ?? {}), [id]: { ...cur, solved: cur.solved + 1, wonLevels: [...new Set([...cur.wonLevels, cur.level])], hints: cur.hints + res.hints, mistakes: cur.mistakes + res.mistakes, categories } },
      };
    });
    setTimeout(sfx.coin, 250);
    return coins;
  };

  const back = () => { if (kind === 'words' && category) setCategory(null); else if (kind) setKind(null); else onExit(); };

  return (
    <div className="screen mines world-puzzles">
      <div className="mine-top">
        <button className="btn btn-ghost btn-sm" onClick={back}>{kind ? 'לגן החידות' : 'חזרה לאי'}</button>
        <h2 className="mine-title"><Puzzle className="icon" /> גן החידות</h2>
        <CoinPill value={p.coins} />
      </div>

      {!kind && (
        <div className="arena-list">
          <button className="card arena-card" onClick={() => { sfx.tap(); setKind('words'); }}>
            <Type className="icon puzzle-ico" />
            <b>תפזורת מילים</b>
            <span className="muted small">{G('בוחרים נושא ומחפשים את המילים בלוח. גוררים את האצבע מהאות הראשונה לאחרונה.')}</span>
            <Stars won={stat('words').wonLevels} solved={stat('words').solved} />
          </button>
          <button className="card arena-card" onClick={() => { sfx.tap(); setKind('math'); }}>
            <Calculator className="icon puzzle-ico" />
            <b>תפזורת תרגילים</b>
            <span className="muted small">{G('בלוח מסתתרים תרגילים. מוצאים רק את הנכונים, משמאל לימין או מלמעלה למטה.')}</span>
            <Stars won={stat('math').wonLevels} solved={stat('math').solved} />
          </button>
        </div>
      )}

      {kind === 'words' && !category && (
        <div className="card cat-picker">
          <h3>{G('בחר{|י} נושא')}</h3>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button key={c.id} className="cat" onClick={() => { sfx.tap(); setCategory(c.id); }}>
                {c.name}{stat('words').categories?.[c.id] ? <Trophy className="icon" aria-label="פתרת" /> : null}
              </button>
            ))}
            <button className="cat cat-surprise" onClick={() => { sfx.tap(); setCategory(CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].id); }}><Shuffle className="icon" /> הפתעה</button>
          </div>
        </div>
      )}

      {kind && (kind === 'math' || category) && (
        <LevelPicker level={stat(kind).level} won={stat(kind).wonLevels} rules={kind === 'words' ? WS_RULES : MS_RULES} onPick={(l) => setLevel(kind, l)} />
      )}
      {kind === 'words' && category && (
        <WordSearch key={`${category}-${stat('words').level}`} level={stat('words').level as Level} category={category} onDone={(r) => finish('words', { ...r, category })} />
      )}
      {kind === 'math' && <MathSearch key={`m-${stat('math').level}`} level={stat('math').level as Level} onDone={(r) => finish('math', r)} />}
    </div>
  );
}

function Stars({ won, solved }: { won: number[]; solved: number }) {
  return (
    <span className="level-stars">
      {[1, 2, 3].map((l) => <span key={l} className={`lvl ${won.includes(l) ? 'won' : ''}`}>{l}</span>)}
      <small>נפתרו: {solved}</small>
    </span>
  );
}

function LevelPicker({ level, won, rules, onPick }: { level: number; won: number[]; rules: Record<number, string[]>; onPick: (l: number) => void }) {
  return (
    <div className="card level-picker">
      <div className="seg" role="radiogroup" aria-label="רמה">
        {[1, 2, 3].map((l) => (
          <button key={l} role="radio" aria-checked={level === l} className={level === l ? 'on' : ''} onClick={() => { sfx.tap(); onPick(l); }}>
            <span className="lvl-num">{l}</span> {LEVEL_NAME[l]} {won.includes(l) && <Trophy className="icon" aria-label="פתרת ברמה הזו" />}
          </button>
        ))}
      </div>
      <ul className="rules">{rules[level].map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}

/**
 * A grid where the child marks a straight line: drag from the first cell to the last, or tap the
 * first cell and then the last one. Pointer capture keeps the drag alive when the finger leaves a cell.
 */
function LineGrid({ rows, cols, style, className, cell, onSelect }: {
  rows: number; cols: number; style?: CSSProperties; className: string;
  cell: (r: number, c: number, inLine: boolean, isAnchor: boolean) => ReactNode;
  onSelect: (a: Cell, b: Cell) => void;
}) {
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [hover, setHover] = useState<Cell | null>(null);
  const drag = useRef(false);
  const moved = useRef(false);
  const at = (x: number, y: number): Cell | null => {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-cell]');
    if (!el) return null;
    const [r, c] = el.dataset.cell!.split(',').map(Number);
    return [r, c];
  };
  const line = useMemo(() => new Set(anchor && hover ? (straightLine(anchor, hover) ?? [anchor]).map(k) : anchor ? [k(anchor)] : []), [anchor, hover]);

  return (
    <div
      className={className} style={style} role="grid" aria-label="לוח התפזורת"
      onPointerDown={(e) => {
        const c = at(e.clientX, e.clientY);
        if (!c) return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        if (anchor && !drag.current) {
          // second tap of tap-tap mode
          if (k(c) !== k(anchor)) onSelect(anchor, c);
          setAnchor(null); setHover(null);
          return;
        }
        drag.current = true; moved.current = false;
        setAnchor(c); setHover(c);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        const c = at(e.clientX, e.clientY);
        if (c && (!hover || k(c) !== k(hover))) { setHover(c); if (anchor && k(c) !== k(anchor)) moved.current = true; }
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        drag.current = false;
        if (moved.current && anchor && hover && k(anchor) !== k(hover)) { onSelect(anchor, hover); setAnchor(null); setHover(null); }
      }}
      onPointerCancel={() => { drag.current = false; setAnchor(null); setHover(null); }}
    >
      {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => cell(r, c, line.has(k([r, c])), !!anchor && anchor[0] === r && anchor[1] === c)))}
    </div>
  );
}

function WordSearch({ level, category, onDone }: { level: Level; category: string; onDone: (r: { hints: number; mistakes: number }) => number }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const cat = CATEGORIES.find((c) => c.id === category)!;
  const [round, setRound] = useState(0);
  const grid = useMemo(() => makeWordGrid(level, cat.words, makeRng(Date.now() + round)), [level, cat, round]);
  const [found, setFound] = useState<Record<string, number>>({});
  const [hint, setHint] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [miss, setMiss] = useState(false);
  const [coins, setCoins] = useState<number | null>(null);
  const done = coins !== null;

  const foundCells = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of grid.placements) if (found[p.word] !== undefined) for (const c of p.cells) m.set(k(c), found[p.word]);
    return m;
  }, [grid, found]);

  const select = (a: Cell, b: Cell) => {
    const p = matchSelection(grid, a, b);
    if (p && found[p.word] === undefined) {
      const next = { ...found, [p.word]: Object.keys(found).length % FOUND_COLORS };
      setFound(next); setHint(null); sfx.correct();
      if (Object.keys(next).length === grid.placements.length) { celebrate(); sfx.win(); setCoins(onDone({ hints, mistakes })); }
      else burst(0.5, 0.4);
    } else if (!p) { setMistakes((m) => m + 1); setMiss(true); sfx.tap(); setTimeout(() => setMiss(false), 400); }
  };
  const giveHint = () => {
    const left = grid.placements.filter((p) => found[p.word] === undefined);
    if (!left.length) return;
    const p = left[Math.floor(Math.random() * left.length)];
    setHint(k(p.start)); setHints((h) => h + 1); sfx.pop();
  };
  const again = () => { setRound((r) => r + 1); setFound({}); setHints(0); setMistakes(0); setCoins(null); setHint(null); };

  return (
    <div className="card puzzle-card">
      <div className="puzzle-head">
        <b>{cat.name}</b>
        <span className="muted"><bdi dir="ltr">{Object.keys(found).length}/{grid.placements.length}</bdi></span>
      </div>
      <ul className="word-list">
        {grid.placements.map((p) => <li key={p.word} className={found[p.word] !== undefined ? `got f${found[p.word]}` : ''}>{p.word}</li>)}
      </ul>
      <LineGrid
        rows={grid.size} cols={grid.size} className={`ws-grid ${miss ? 'miss' : ''}`} style={{ ['--n' as string]: grid.size }}
        onSelect={select}
        cell={(r, c, inLine, isAnchor) => {
          const f = foundCells.get(k([r, c]));
          return (
            <div key={`${r}-${c}`} data-cell={`${r},${c}`} role="gridcell"
              className={`ws-cell ${f !== undefined ? `found f${f}` : ''} ${inLine ? 'sel' : ''} ${isAnchor ? 'anchor' : ''} ${hint === k([r, c]) ? 'hint' : ''}`}>
              {grid.letters[r][c]}
            </div>
          );
        }}
      />
      {!done && (
        <div className="row">
          {level < 3 && <button className="btn btn-ghost" onClick={giveHint}><Lightbulb className="icon" /> רמז</button>}
          <span className="muted small">{G('גרר{|י} מהאות הראשונה לאחרונה, או הקש{|י} על שתיהן.')}</span>
        </div>
      )}
      {done && (
        <div className="lookback">
          <h3>{G('מצאת את כל המילים!')}</h3>
          <p><bdi dir="ltr">+{coins}</bdi> מטבעות{hints === 0 ? G(', ובלי אף רמז') : ''}.</p>
          <button className="btn btn-yellow" onClick={again}><RotateCcw className="icon" /> עוד תפזורת</button>
        </div>
      )}
    </div>
  );
}

function MathSearch({ level, onDone }: { level: Level; onDone: (r: { hints: number; mistakes: number }) => number }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const [round, setRound] = useState(0);
  const grid = useMemo(() => makeMathGrid(level, makeRng(Date.now() + round)), [level, round]);
  const [found, setFound] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [coins, setCoins] = useState<number | null>(null);
  const done = coins !== null;

  const foundCells = useMemo(() => {
    const m = new Map<string, number>();
    found.forEach((i, n) => grid.correct[i].cells.forEach((c) => m.set(k(c), n % FOUND_COLORS)));
    return m;
  }, [grid, found]);

  const select = (a: Cell, b: Cell) => {
    const res = checkMathSelection(grid, a, b);
    if (res === null) { setNote(G('תרגיל הוא חמש משבצות בשורה: מספר, סימן, מספר, סימן, מספר.')); sfx.tap(); return; }
    if (res === 'wrong') { setMistakes((m) => m + 1); setNote(`${G('כמעט! בדק{|י} שוב:')} ${explainWrong(grid, a, b)}`); sfx.tap(); return; }
    const i = grid.correct.indexOf(res);
    if (found.includes(i)) { setNote(G('את התרגיל הזה כבר מצאת.')); return; }
    const next = [...found, i];
    setFound(next); setNote(null); setHint(null); sfx.correct();
    if (next.length === grid.correct.length) { celebrate(); sfx.win(); setCoins(onDone({ hints, mistakes })); }
    else burst(0.5, 0.4);
  };
  const giveHint = () => {
    const left = grid.correct.map((_, i) => i).filter((i) => !found.includes(i));
    if (!left.length) return;
    setHint(k(grid.correct[left[Math.floor(Math.random() * left.length)]].cells[0])); setHints((h) => h + 1); sfx.pop();
  };
  const again = () => { setRound((r) => r + 1); setFound([]); setHints(0); setMistakes(0); setCoins(null); setHint(null); setNote(null); };
  const template = Array.from({ length: grid.cols }, (_, i) => (i % 2 ? '0.62fr' : '1fr')).join(' ');
  const rowsTemplate = Array.from({ length: grid.rows }, (_, i) => (i % 2 ? '0.62fr' : '1fr')).join(' ');

  return (
    <div className="card puzzle-card">
      <div className="puzzle-head">
        <b>{G('מצא{|י} את התרגילים הנכונים')}</b>
        <span className="muted"><bdi dir="ltr">{found.length}/{grid.correct.length}</bdi></span>
      </div>
      <LineGrid
        rows={grid.rows} cols={grid.cols} className="ms-grid" onSelect={select}
        style={{ gridTemplateColumns: template, gridTemplateRows: rowsTemplate, ['--n' as string]: (grid.cols + 1) / 2 }}
        cell={(r, c, inLine, isAnchor) => {
          const t = grid.tokens[r][c];
          const f = foundCells.get(k([r, c]));
          const cls = t.kind === 'num' ? 'ms-num' : t.kind === 'op' ? `ms-op ${t.op === '=' ? 'eq' : ''}` : 'ms-blank';
          return (
            <div key={`${r}-${c}`} data-cell={`${r},${c}`} role="gridcell"
              className={`ms-cell ${cls} ${f !== undefined ? `found f${f}` : ''} ${inLine && t.kind !== 'blank' ? 'sel' : ''} ${isAnchor ? 'anchor' : ''} ${hint === k([r, c]) ? 'hint' : ''}`}>
              {t.kind === 'num' ? t.value : t.kind === 'op' ? opText(t.op) : ''}
            </div>
          );
        }}
      />
      {note && <p className="puzzle-note" aria-live="polite">{note}</p>}
      {found.length > 0 && (
        <ul className="ex-list">{found.map((i, n) => <li key={i} className={`f${n % FOUND_COLORS}`}><bdi dir="ltr">{grid.correct[i].text}</bdi></li>)}</ul>
      )}
      {!done && (
        <div className="row">
          {level < 3 && <button className="btn btn-ghost" onClick={giveHint}><Lightbulb className="icon" /> רמז</button>}
          <span className="muted small">{G('גרר{|י} מהמספר הראשון עד התוצאה, או הקש{|י} על שניהם.')}</span>
        </div>
      )}
      {done && (
        <div className="lookback">
          <h3>{G('מצאת את כל התרגילים הנכונים!')}</h3>
          <p><bdi dir="ltr">+{coins}</bdi> מטבעות{mistakes === 0 ? G(', ובלי אף טעות') : ''}.</p>
          <button className="btn btn-yellow" onClick={again}><RotateCcw className="icon" /> עוד לוח</button>
        </div>
      )}
    </div>
  );
}
