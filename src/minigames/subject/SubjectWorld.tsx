import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../core/store';
import { NODES, NODE_BY_ID, MISTAKES, STRATEGIES } from '../../brain/curriculum';
import { classifyMistake, generateItem } from '../../brain/generators';
import {
  chooseTier, newSkill, newStrategy, nodeStatus, placementNext, placementStart, PLACEMENT_ANCHORS,
  priorTheta, recommend, seedFromPlacement, updateSkill, updateStrategy, expected, type NodeStatus,
} from '../../brain/model';
import type { Attempt, Grade, Item, MistakeType, StrategyId, Subject } from '../../brain/types';
import { COINS, JOURNEY_LENGTH, dayKey, rollSurprise, type Collectible } from '../../economy/economy';
import { addAttempt, type PlayerDoc } from '../../data/db';
import { g, makeRng, pick } from '../../core/rng';
import { sfx, speak } from '../../core/audio';
import { WeekDots } from '../../ui/Hud';

type Mode = 'journey' | 'practice' | 'placement';
type Phase = 'answer' | 'retry' | 'solved' | 'revealed';

interface Session {
  mode: Mode;
  total: number;
  count: number;
  firstTryCorrect: number;
  recent: boolean[];
  coins: number;
  mastered: string[];
  strategiesUsed: StrategyId[];
  lastNode?: string;
  fixedNode?: string;
  placement?: { index: number; answered: number; results: { nodeId: string; correct: boolean }[] };
  surprise?: Collectible | null;
}

const rng = makeRng(Date.now() & 0xffffffff);

export interface WorldConfig {
  id: string;
  subject: Subject;
  title: string;
  emoji: string;
  /** Word for a topic in this world: מנהרה in the mines, מדף in the library... */
  topicWord: string;
  learningLabel: string;
  masteredIcon: string;
  placement: boolean;
  /** Short intro line on the world's lobby. */
  intro: string;
}

export const WORLDS: Record<'mines' | 'library' | 'lab', WorldConfig> = {
  mines: { id: 'mines', subject: 'math', title: 'מכרות המספרים', emoji: '⛏️', topicWord: 'מנהרה', learningLabel: 'בחפירה', masteredIcon: '💎', placement: true, intro: 'כל מנהרה היא נושא בחשבון.' },
  library: { id: 'library', subject: 'language', title: 'ספריית המילים', emoji: '📚', topicWord: 'מדף', learningLabel: 'בקריאה', masteredIcon: '📜', placement: false, intro: 'כל מדף הוא נושא בלשון: דקדוק, אוצר מילים והבנת הנקרא.' },
  lab: { id: 'lab', subject: 'science', title: 'מעבדת הטבע', emoji: '🔬', topicWord: 'ניסוי', learningLabel: 'בניסוי', masteredIcon: '🧪', placement: false, intro: 'כל שולחן במעבדה הוא נושא במדע: חומרים, בעלי חיים, צמחים וחשמל.' },
};

const statusUi = (c: WorldConfig): Record<NodeStatus, { icon: string; label: string }> => ({
  locked: { icon: '🔒', label: 'נעול' },
  new: { icon: '✨', label: 'חדש' },
  learning: { icon: c.emoji, label: c.learningLabel },
  struggling: { icon: '💪', label: 'מתאמנים' },
  mastered: { icon: c.masteredIcon, label: 'נכבש!' },
  review_due: { icon: '🔁', label: 'לחזרה' },
});

const PRAISE = [
  (s: string) => `נכון! האסטרטגיה "${s}" עובדת כאן מצוין.`,
  () => 'נכון! חשבת צעד אחרי צעד.',
  () => 'יפה! ראית את המבנה של התרגיל.',
  () => 'נכון! ככה בדיוק חושבים על זה.',
];

export function SubjectWorld({ config, onExit }: { config: WorldConfig; onExit: () => void }) {
  const { player, updatePlayer, showToast } = useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [reason, setReason] = useState<string>('');
  const [phase, setPhase] = useState<Phase>('answer');
  const [value, setValue] = useState('');
  const [hints, setHints] = useState(0);
  const [firstMistake, setFirstMistake] = useState<MistakeType | undefined>();
  const [feedback, setFeedback] = useState('');
  const [reflected, setReflected] = useState<StrategyId | 'knew' | null>(null);
  const [askReflect, setAskReflect] = useState(false);
  const [wrongChoices, setWrongChoices] = useState<string[]>([]);
  const [summary, setSummary] = useState<Session | null>(null);
  const started = useRef(0);

  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const now = Date.now();

  const nextItem = useCallback((s: Session, pl: PlayerDoc) => {
    let nodeId: string, tier: 1 | 2 | 3, why = '';
    if (s.mode === 'placement') {
      const a = PLACEMENT_ANCHORS[s.placement!.index];
      nodeId = a.nodeId; tier = a.tier; why = 'placement';
    } else if (s.mode === 'practice') {
      nodeId = s.fixedNode!;
      const sk = pl.skills[nodeId] ?? newSkill(nodeId, priorTheta(NODE_BY_ID[nodeId].grade, pl.grade));
      tier = chooseTier(sk, s.recent.slice(-2).every((x) => !x) && s.recent.length >= 2 ? 0.88 : 0.8);
      why = 'practice';
    } else {
      const r = recommend(pl.skills, { now: Date.now(), grade: pl.grade, sessionRecent: s.recent, rng, avoidNode: s.lastNode, subject: config.subject });
      nodeId = r.nodeId; tier = r.tier; why = r.reason;
    }
    const it = generateItem(nodeId, tier, rng);
    setItem(it);
    setReason(why);
    setPhase('answer');
    setValue('');
    setHints(0);
    setFirstMistake(undefined);
    setFeedback('');
    setReflected(null);
    setAskReflect(false);
    setWrongChoices([]);
    started.current = Date.now();
  }, [config.subject]);

  const begin = (mode: Mode, fixedNode?: string) => {
    sfx.tap();
    const s: Session = {
      mode, fixedNode,
      total: mode === 'placement' ? 6 : mode === 'practice' ? 5 : JOURNEY_LENGTH,
      count: 0, firstTryCorrect: 0, recent: [], coins: 0, mastered: [], strategiesUsed: [],
      placement: mode === 'placement' ? { index: placementStart(p.grade), answered: 0, results: [] } : undefined,
    };
    setSummary(null);
    setSession(s);
    nextItem(s, p);
  };

  /** Resolve the item: store the attempt, update the learner model and the economy. */
  const finalize = (correct: boolean, firstTry: boolean, given: string, mistake?: MistakeType) => {
    if (!item || !session) return;
    const t = Date.now();
    const mode = session.mode;
    const isReview = reason === 'review';
    const attempt: Attempt = {
      playerId: p.id, itemId: item.id, nodeId: item.nodeId, tier: item.tier,
      correct, firstTry, hintsUsed: hints, timeMs: t - started.current,
      mistake, given, mode: isReview ? 'review' : mode, at: t,
    };
    void addAttempt(attempt);

    let coins = 0;
    const newlyMastered: string[] = [];
    const s: Session = {
      ...session,
      recent: [...session.recent, firstTry && hints === 0],
      firstTryCorrect: session.firstTryCorrect + (firstTry && hints === 0 ? 1 : 0),
      lastNode: item.nodeId,
      strategiesUsed: [...new Set([...session.strategiesUsed, ...item.strategies])],
    };

    updatePlayer((pl) => {
      const skills = { ...pl.skills };
      const strategies = { ...pl.strategies };
      if (mode !== 'placement') {
        const prev = skills[item.nodeId] ?? newSkill(item.nodeId, priorTheta(NODE_BY_ID[item.nodeId].grade, pl.grade));
        const wasMastered = prev.mastered;
        const r = updateSkill(prev, item, firstTry, { now: t, isReview, mistake, hintsUsed: hints });
        skills[item.nodeId] = r.skill;
        if (r.becameMastered) newlyMastered.push(item.nodeId);
        if (isReview && wasMastered && firstTry) coins += COINS.reviewKept;
        for (const sid of item.strategies) {
          strategies[sid] = updateStrategy(strategies[sid] ?? newStrategy(sid), item.difficulty, firstTry && hints === 0);
        }
        coins += correct ? (firstTry && hints === 0 ? COINS.firstTry : COINS.afterRetryOrHint) : 0;
        coins += newlyMastered.length * COINS.mastery;
      }
      return {
        ...pl, skills, strategies,
        coins: pl.coins + coins,
        badges: [...pl.badges, ...newlyMastered.filter((b) => !pl.badges.includes(b))],
      };
    });

    s.coins += coins;
    s.mastered = [...s.mastered, ...newlyMastered];
    if (mode === 'placement') {
      const pl = s.placement!;
      s.placement = { ...pl, answered: pl.answered + 1, results: [...pl.results, { nodeId: item.nodeId, correct }] };
    }
    setSession(s);

    if (correct) {
      sfx.correct();
      if (coins) setTimeout(sfx.coin, 250);
      setPhase('solved');
      if (mode === 'placement') setFeedback('נכון! ממשיכים.');
      else if (!firstTry) setFeedback(G('נכון! אחרי טעות ניסית שוב, וככה לומדים באמת.'));
      else if (hints > 0) setFeedback('נכון! הרמז עזר לראות את הדרך, וזה בדיוק התפקיד שלו.');
      else setFeedback(pick(rng, PRAISE)(STRATEGIES[item.strategies[0]].name));
      if (mode !== 'placement' && firstTry && hints === 0 && rng() < 0.35) setAskReflect(true);
    } else {
      sfx.wrong();
      setPhase('revealed');
      const specific = item.choiceFeedback?.[given];
      setFeedback(mode === 'placement' ? G('לא נורא! זה עוזר לנו לדעת מאיפה להתחיל. ממשיכים.') : specific ?? G(MISTAKES[mistake ?? 'other'].kid));
    }
    if (newlyMastered.length) {
      setTimeout(() => { sfx.win(); showToast(`💎 ${G('שלטת')} ב"${NODE_BY_ID[newlyMastered[0]].title}"! +${COINS.mastery}`); }, 500);
    }
  };

  const submit = () => {
    if (!item || (phase !== 'answer' && phase !== 'retry')) return;
    const given = value.trim();
    if (!given) return;
    const correct = item.choices ? given === item.correctChoice : Number(given) === item.answer;
    if (correct) { finalize(true, phase === 'answer', given, firstMistake); return; }
    const mistake = classifyMistake(item, given);
    if (phase === 'answer' && session?.mode !== 'placement') {
      sfx.wrong();
      setFirstMistake(mistake);
      // Retry feedback is informational: a known misconception, a classified mistake, or the pointer hint.
      const retryText = item.choiceFeedback?.[given] ?? (mistake === 'other' ? `כמעט. 💡 ${item.hints[1].text}` : G(MISTAKES[mistake].kid));
      setFeedback(retryText + ' ' + G('נס{ה|י} שוב!'));
      if (item.choices) setWrongChoices((w) => [...w, given]);
      setPhase('retry');
      setValue('');
      return;
    }
    finalize(false, false, given, firstMistake ?? mistake);
  };

  const finishSession = (s: Session) => {
    const t = Date.now();
    let surprise: Collectible | null = null;
    updatePlayer((pl) => {
      if (s.mode === 'placement') {
        const seeded = seedFromPlacement(s.placement!.results, pl.grade, t);
        return { ...pl, skills: { ...seeded, ...pl.skills }, placementDone: true, coins: pl.coins + COINS.journeyComplete };
      }
      if (s.mode === 'journey') {
        surprise = rollSurprise(rng, pl.collectibles);
        const today = dayKey(t);
        return {
          ...pl,
          journeyDays: { ...(pl.journeyDays ?? {}), [config.subject]: today },
          coins: pl.coins + COINS.journeyComplete,
          journeysCompleted: pl.journeysCompleted + 1,
          lastJourneyDay: today,
          playedDays: pl.playedDays.includes(today) ? pl.playedDays : [...pl.playedDays, today].slice(-120),
          collectibles: surprise ? [...pl.collectibles, (surprise as Collectible).id] : pl.collectibles,
        };
      }
      return pl;
    });
    if (s.mode !== 'practice') sfx.win();
    setSummary({ ...s, surprise, coins: s.coins + (s.mode === 'practice' ? 0 : COINS.journeyComplete) });
    setSession(null);
    setItem(null);
  };

  const cont = () => {
    if (!session) return;
    const s = { ...session, count: session.count + 1 };
    if (s.mode === 'placement') {
      const pl = s.placement!;
      const last = pl.results[pl.results.length - 1];
      const nxt = placementNext(pl.index, last.correct, pl.answered);
      if (nxt === null) { finishSession(s); return; }
      s.placement = { ...pl, index: nxt };
    } else if (s.count >= s.total) { finishSession(s); return; }
    setSession(s);
    nextItem(s, useApp.getState().player!);
  };

  // Physical keyboard: digits, Backspace, Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!item) return;
      if (phase === 'solved' || phase === 'revealed') { if (e.key === 'Enter') { e.preventDefault(); cont(); } return; }
      if (item.choices) return;
      if (/^\d$/.test(e.key)) setValue((v) => (v.length < 4 ? v + e.key : v));
      else if (e.key === 'Backspace') setValue((v) => v.slice(0, -1));
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const statuses = useMemo(
    () => Object.fromEntries(NODES.map((n) => [n.id, nodeStatus(n.id, p.skills, now)])) as Record<string, NodeStatus>,
    [p.skills, now],
  );
  const journeyDoneToday = (p.journeyDays?.[config.subject] ?? (config.subject === 'math' ? p.lastJourneyDay : undefined)) === dayKey(now);
  const STATUS_UI = statusUi(config);
  const needsPlacement = config.placement && !p.placementDone;

  // ---------- summary ----------
  if (summary) {
    const s = summary;
    return (
      <div className={`screen mines world-${config.id}`}>
        <div className="card summary">
          {s.mode === 'placement' ? (
            <>
              <h2>🗺️ {G('מצאנו את נקודת ההתחלה שלך!')}</h2>
              <p>המכרה יודע עכשיו מאיפה כדאי להתחיל, והוא ימשיך להכיר {G('אותך')} בכל משחק.</p>
              <p className="big-coins">+🪙 {s.coins}</p>
              <button className="btn btn-yellow btn-lg" onClick={() => begin('journey')}>⛏️ למסע הראשון</button>
            </>
          ) : (
            <>
              <h2>{s.mode === 'journey' ? '🎉 המסע של היום הושלם!' : '✅ סיום אימון'}</h2>
              <p className="big-coins">+🪙 {s.coins}</p>
              <p>{s.firstTryCorrect} מתוך {s.total} {G('פתרת')} כבר בניסיון הראשון.</p>
              {s.mastered.length > 0 && (
                <div className="badges">{s.mastered.map((m) => <span key={m} className="badge">💎 {NODE_BY_ID[m].title}</span>)}</div>
              )}
              {s.surprise && (
                <div className="surprise">✨ {G('מצאת')} אוצר במכרה: <b>{s.surprise.emoji} {s.surprise.name}</b>! הוא מחכה ליד עץ החשיבה.</div>
              )}
              <div className="lookback">
                <h3>🔎 מבט לאחור</h3>
                <p>היום {G('השתמשת')} באסטרטגיות:</p>
                <div className="strats">{s.strategiesUsed.map((id) => <span key={id} className="strat">{STRATEGIES[id].icon} {STRATEGIES[id].name}</span>)}</div>
                <p className="muted">{G('איזו מהן עזרה לך הכי הרבה? נס{ה|י} לספר למישהו בבית.')}</p>
              </div>
              {s.mode === 'journey' && <><h3>היעד השבועי</h3><WeekDots playedDays={useApp.getState().player!.playedDays} /></>}
              <div className="row">
                <button className="btn btn-pink" onClick={onExit}>🏝️ חזרה לאי</button>
                <button className="btn btn-ghost" onClick={() => setSummary(null)}>⛏️ להמשיך במכרה</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------- question ----------
  if (session && item) {
    const node = NODE_BY_ID[item.nodeId];
    const [promptText, picture] = item.prompt.split('\n');
    const done = phase === 'solved' || phase === 'revealed';
    const progress = session.mode === 'placement' ? session.placement!.answered : session.count;
    return (
      <div className={`screen mines world-${config.id}`}>
        <div className="mine-top">
          <button className="btn btn-ghost btn-sm" onClick={() => { setSession(null); setItem(null); }}>✕ יציאה</button>
          <div className="carts" aria-label={`תרגיל ${progress + 1} מתוך ${session.total}`}>
            {Array.from({ length: session.total }, (_, i) => (
              <span key={i} className={`cart ${i < progress ? 'full' : ''} ${i === progress ? 'now' : ''}`}>{i < progress ? '💎' : '🛒'}</span>
            ))}
          </div>
          <span className="coins">🪙 {useApp.getState().player!.coins}</span>
        </div>

        <div className="card question">
          <div className="q-meta">
            <span className="tag">כיתה {node.grade === 2 ? "ב'" : "ג'"} · {node.short}</span>
            {reason === 'review' && <span className="tag tag-review">🔁 חזרה: {G('זוכר{|ת}')}?</span>}
            {reason === 'new' && <span className="tag tag-new">✨ נושא חדש</span>}
            {session.mode === 'placement' && <span className="tag">🗺️ מסע היכרות</span>}
            <button className="icon-btn" onClick={() => speak(item.speech)} aria-label="הקראה">🔈</button>
          </div>
          {item.passage && <div className="passage">{item.passage}</div>}
          <p className="q-prompt">{promptText}</p>
          {picture && <p className="q-picture">{picture}</p>}
          {item.expr && !picture && (
            <div className="q-expr" dir="ltr">
              {item.expr.includes('☐')
                ? item.expr.split('☐').map((part, i, arr) => (
                  <span key={i}>{part}{i < arr.length - 1 && <span className={`slot ${phase === 'retry' ? 'retry' : ''}`}>{value || ' '}</span>}</span>
                ))
                : <>{item.expr} = <span className={`slot ${phase === 'retry' ? 'retry' : ''}`}>{done && phase === 'revealed' ? item.answer : value || ' '}</span></>}
            </div>
          )}
          {!item.expr?.length || picture ? (
            !item.choices && <div className="q-expr" dir="ltr"><span className={`slot ${phase === 'retry' ? 'retry' : ''}`}>{done && phase === 'revealed' ? item.answer : value || ' '}</span></div>
          ) : null}

          {item.choices && (
            <div className="choices">
              {item.choices.map((c) => (
                <button key={c} disabled={done || wrongChoices.includes(c)}
                  className={`choice ${value === c ? 'on' : ''} ${done && c === item.correctChoice ? 'right' : ''} ${wrongChoices.includes(c) ? 'wrong' : ''}`}
                  onClick={() => { sfx.tap(); setValue(c); }}>{c}</button>
              ))}
            </div>
          )}

          {feedback && <div className={`feedback ${phase}`}>{feedback}</div>}
          {phase === 'revealed' && session.mode !== 'placement' && (
            <div className="explain"><b>ככה פותרים:</b> <span dir={item.expr ? 'ltr' : undefined}>{item.explain}</span>{item.hints[2].text !== item.explain && !item.explain.includes(item.hints[2].text) && <><br />{item.hints[2].text}</>}</div>
          )}

          {hints > 0 && !done && (
            <div className="hints">
              {item.hints.slice(0, hints).map((h) => <p key={h.level}>💡 {h.text}</p>)}
            </div>
          )}

          {askReflect && !reflected && (
            <div className="reflect">
              <p>🤔 {G('איך פתרת?')} (לא חובה)</p>
              <div className="row wrap">
                {item.strategies.map((sid) => (
                  <button key={sid} className="chip" onClick={() => {
                    setReflected(sid);
                    updatePlayer((pl) => ({ ...pl, strategies: { ...pl.strategies, [sid]: { ...(pl.strategies[sid] ?? newStrategy(sid)), selfReported: (pl.strategies[sid]?.selfReported ?? 0) + 1 } } }));
                  }}>{STRATEGIES[sid].icon} {STRATEGIES[sid].name}</button>
                ))}
                <button className="chip" onClick={() => setReflected('knew')}>🧠 פשוט {G('ידעתי')}</button>
              </div>
            </div>
          )}
          {reflected && <p className="muted">{reflected === 'knew' ? 'מעולה! כשיודעים בעל פה, החשבון נעשה מהיר.' : 'יפה ששמת לב איך חשבת. זה סוד של פותרי בעיות טובים.'}</p>}

          {!done ? (
            <>
              {!item.choices && (
                <div className="keypad" dir="ltr">
                  {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
                    <button key={d} onClick={() => setValue((v) => (v.length < 4 ? v + d : v))}>{d}</button>
                  ))}
                  <button className="k-del" onClick={() => setValue((v) => v.slice(0, -1))} aria-label="מחיקה">⌫</button>
                  <button onClick={() => setValue((v) => (v.length < 4 ? v + '0' : v))}>0</button>
                  <button className="k-ok" onClick={submit} disabled={!value}>✓</button>
                </div>
              )}
              <div className="row">
                {item.choices && <button className="btn btn-pink btn-lg" disabled={!value} onClick={submit}>✓ {G('בד{וק|קי}')}</button>}
                {session.mode !== 'placement' && hints < 3 && (
                  <button className="btn btn-ghost" onClick={() => { sfx.tap(); setHints((h) => h + 1); }}>💡 רמז {hints > 0 ? `(${hints}/3)` : ''}</button>
                )}
              </div>
            </>
          ) : (
            <button className="btn btn-yellow btn-lg" onClick={cont}>המשך ←</button>
          )}
        </div>
      </div>
    );
  }

  // ---------- lobby ----------
  const floors: Grade[] = [2, 3];
  return (
    <div className={`screen mines world-${config.id}`}>
      <div className="mine-top">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>🏝️ חזרה לאי</button>
        <h2 className="mine-title">{config.emoji} {config.title}</h2>
        <span className="coins">🪙 {p.coins}</span>
      </div>

      <div className="card lobby-hero">
        {needsPlacement ? (
          <>
            <h3>{G('ברו{ך|כה} ה{בא|באה}')} ל{config.title}, {p.nickname}!</h3>
            <p>{G('לפני שיורדים למכרה, מסע קצר של 6 תרגילים כדי שנדע מאיפה להתחיל. אין פה ציון, פשוט עונים הכי טוב שאפשר.')}</p>
            <button className="btn btn-yellow btn-lg" onClick={() => begin('placement')}>🗺️ מסע היכרות</button>
          </>
        ) : (
          <>
            <p className="muted-inv">{config.intro}</p>
            <h3>{journeyDoneToday ? G('המסע של היום כאן הושלם! אפשר להמשיך אם בא לך.') : 'המסע היומי מחכה: 8 שאלות, בערך 10 דקות.'}</h3>
            <button className="btn btn-yellow btn-lg" onClick={() => begin('journey')}>⛏️ {journeyDoneToday ? 'עוד מסע' : 'למסע של היום'}</button>
            <WeekDots playedDays={p.playedDays} />
          </>
        )}
      </div>

      {floors.map((grade) => (
        <div key={grade} className="floor">
          <h3>כיתה {grade === 2 ? "ב'" : "ג'"}</h3>
          <div className="tunnels">
            {NODES.filter((n) => n.grade === grade && n.subject === config.subject).map((n) => {
              const st = statuses[n.id];
              const sk = p.skills[n.id];
              const level = sk ? expected(sk.theta, n.tierDifficulty[1]) : 0;
              return (
                <button key={n.id} className={`tunnel st-${st}`} disabled={st === 'locked' || needsPlacement}
                  onClick={() => begin('practice', n.id)} title={n.title}>
                  <span className="t-icon">{STATUS_UI[st].icon}</span>
                  <span className="t-name">{n.title}</span>
                  <span className="t-state">{STATUS_UI[st].label}</span>
                  {st !== 'locked' && st !== 'new' && <span className="t-bar"><i style={{ width: `${Math.round(level * 100)}%` }} /></span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="muted small center">{config.topicWord} נפתח כשיודעים את מה שבא לפניו. {config.masteredIcon} = {G('שולט{|ת}')}, ואחרי כמה ימים הנושא יחזור לחזרה קצרה כדי שהידע יישאר.</p>
    </div>
  );
}
