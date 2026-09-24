import { useEffect, useRef, useState } from 'react';
import { useApp } from '../core/store';
import { attemptsFor } from '../data/db';
import { buildReport, type ParentReport } from '../brain/insights';
import type { NodeStatus } from '../brain/model';
import { NODE_BY_ID } from '../brain/curriculum';
import { SCENARIOS, SKILLS } from '../minigames/village/scenarios';
import { VALUE_SKILLS, skillSummary } from '../minigames/village/valuesBank';
import { CHAPTERS, chapterKey } from '../minigames/story/storyBank';
import { WORD_BY_ID } from '../minigames/smarter/wordBank';
import { STATUS_LABEL, wordStatus, type WordStatus } from '../minigames/smarter/progress';
import { dayKey } from '../economy/economy';
import { deleteRecording, getRecording } from '../data/db';
import { deleteAccount, isServerMode, type ApiError } from '../data/remote';

const SUBJECTS = [
  { id: 'math', name: 'חשבון · מכרות המספרים', icon: '⛏️' },
  { id: 'language', name: 'לשון · ספריית המילים', icon: '📚' },
  { id: 'science', name: 'מדע · מעבדת הטבע', icon: '🔬' },
] as const;
const ARENA_NAMES: Record<string, string> = { ttt: 'איקס עיגול', c4: 'ארבע בשורה', hanoi: 'מגדלי האנוי' };

const STATUS_TEXT: Record<NodeStatus, string> = {
  locked: 'עוד לא נפתח',
  new: 'חדש',
  learning: 'בתהליך למידה',
  struggling: 'צריך חיזוק',
  mastered: 'שולט',
  review_due: 'שולט (מחכה לחזרה)',
};

/** Hold-to-open gate: easy for an adult, not something a young child stumbles through. */
function Gate({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  const [pct, setPct] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const start = () => {
    clearInterval(timer.current);
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const v = Math.min(1, (Date.now() - t0) / 3000);
      setPct(v);
      if (v >= 1) { clearInterval(timer.current); onOpen(); }
    }, 50);
  };
  const stop = () => { clearInterval(timer.current); setPct(0); };
  useEffect(() => () => clearInterval(timer.current), []);
  return (
    <div className="card gate">
      <h2>אזור הורים</h2>
      <p>כדי להיכנס, לחצו והחזיקו את הכפתור 3 שניות.</p>
      <button className="btn btn-purple btn-lg hold" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>
        <span className="hold-fill" style={{ width: `${pct * 100}%` }} />
        <span className="hold-label">לחיצה ארוכה לכניסה</span>
      </button>
      <button className="btn btn-ghost" onClick={onBack}>חזרה למשחק</button>
    </div>
  );
}

export function Parent() {
  const { player, go } = useApp();
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<ParentReport | null>(null);

  useEffect(() => {
    if (!open || !player) return;
    void attemptsFor(player.id).then((att) => setReport(buildReport(player.skills, player.strategies, att, Date.now())));
  }, [open, player]);

  if (!player) return null;
  const back = () => go('world');
  const villageSkills = [...new Set(Object.entries(player.village ?? {}).flatMap(([id, choices]) => {
    const sc = SCENARIOS.find((x) => x.id === id);
    return sc ? choices.map((c) => sc.choices[Number(c)]?.skill).filter((x): x is string => !!x) : [];
  }))];

  return (
    <div className="screen parent">
      {!open ? <Gate onOpen={() => setOpen(true)} onBack={back} /> : !report ? <div className="card">טוען…</div> : (
        <>
          <div className="parent-head">
            <h2>הדוח של {player.nickname}</h2>
            <button className="btn btn-ghost btn-sm" onClick={back}>חזרה למשחק</button>
          </div>

          <div className="stats">
            <div className="stat"><b>{report.week.attempts}</b><span>תרגילים השבוע</span></div>
            <div className="stat"><b>{Math.round(report.week.firstTryRate * 100)}%</b><span>הצלחה בניסיון ראשון</span></div>
            <div className="stat"><b>{report.week.minutes}</b><span>דקות למידה השבוע</span></div>
            <div className="stat"><b>{player.playedDays.length}</b><span>ימי מסע בסך הכול</span></div>
          </div>
          <p className="muted small">היעד הוא הצלחה של 75-85% בניסיון ראשון. אחוז כזה אומר שהתרגילים מאתגרים בדיוק במידה הנכונה. 100% קבוע אומר שכדאי להעלות רמה, והמשחק עושה את זה לבד.</p>

          <div className="grid2">
            <div className="card">
              <h3>💪 חוזקות</h3>
              {report.strengths.length ? <ul>{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="muted">עוד מוקדם. אחרי כמה מסעות יופיעו כאן הנושאים שבשליטה.</p>}
            </div>
            <div className="card">
              <h3>🎯 כדאי לחזק</h3>
              {report.focus.length ? <ul>{report.focus.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="muted">אין כרגע נושא שנתקעים בו.</p>}
              {report.patterns.length > 0 && (
                <>
                  <h4>דפוסי טעות שחוזרים</h4>
                  <ul>{report.patterns.map((p) => <li key={p.type}>{p.text} <span className="muted">({p.count} פעמים, ב{p.nodes.join(', ')})</span></li>)}</ul>
                </>
              )}
            </div>
          </div>

          <div className="card talk">
            <h3>🗣️ שאלה לשיחת ערב</h3>
            <p>{report.talkQuestion}</p>
          </div>

          <div className="card">
            <h3>🧠 אסטרטגיות חשיבה</h3>
            <div className="strat-bars">
              {report.strategies.map((s) => (
                <div key={s.id} className="sbar">
                  <span>{s.icon} {s.name}</span>
                  <span className="bar"><i style={{ width: `${Math.round(s.level * 100)}%` }} /></span>
                  <small className="muted">{s.selfReported ? `דיווח עצמי: ${s.selfReported}` : ''}</small>
                </div>
              ))}
            </div>
          </div>

          {SUBJECTS.map((sub) => (
            <div className="card" key={sub.id}>
              <h3>{sub.icon} {sub.name}</h3>
              <div className="table-wrap">
                <table className="nodes">
                  <thead><tr><th>כיתה</th><th>נושא</th><th>מצב</th><th>רמה</th></tr></thead>
                  <tbody>
                    {report.nodes.filter((n) => NODE_BY_ID[n.nodeId].subject === sub.id).map((n) => (
                      <tr key={n.nodeId} className={`st-${n.status}`}>
                        <td>{n.grade === 2 ? "ב'" : "ג'"}</td>
                        <td>{n.title}</td>
                        <td>{STATUS_TEXT[n.status]}</td>
                        <td>{n.attempts ? <span className="bar"><i style={{ width: `${Math.round(n.level * 100)}%` }} /></span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="grid2">
            <div className="card">
              <h3>ארנה החשיבה</h3>
              {player.arena && Object.keys(player.arena).length ? (
                <ul>
                  {Object.entries(player.arena).map(([id, a]) => (
                    <li key={id}>{ARENA_NAMES[id] ?? id}: רמה {a.level} מתוך 3 · {a.wins} ניצחונות, {a.draws} תיקו, {a.losses} הפסדים{a.best ? ` · שיא: ${a.best} מהלכים` : ''}</li>
                  ))}
                </ul>
              ) : <p className="muted">עוד לא שיחקו בארנה.</p>}
              <p className="muted small">המשחק רושם כשהילד מזהה איום וחוסם אותו, או מפספס מהלך מנצח. זה נכנס לפס "לזהות איום" ו"לחשוב צעד קדימה" למעלה.</p>
            </div>
            <div className="card">
              <h3>כפר החברים</h3>
              {villageSkills.length ? (
                <>
                  <p>כלים חברתיים שהילד בחר בהם לפחות פעם אחת:</p>
                  <div className="strats">{villageSkills.map((sk) => <span key={sk} className="strat">{SKILLS[sk]}</span>)}</div>
                </>
              ) : <p className="muted">עוד לא ביקרו בכפר.</p>}
              <p className="muted small">בכפר אין ציון. אנחנו לא מדרגים ילדים בערכים. הרשימה מראה רק אילו כלים הילד כבר הכיר, כדי שיהיה לכם על מה לדבר.</p>
            </div>
          </div>

          <div className="grid2">
            <ValuesSection values={player.values} />
            <StorySection read={player.storyRead} />
          </div>
          <PuzzlesSection puzzles={player.puzzles} />
          <SmarterSection />
          {isServerMode() && <ServerDataSection />}

          <p className="privacy">🔒 כל הנתונים נשמרים רק במכשיר הזה. זו גרסה ניסיונית. הנושאים מבוססים על תוכניות הלימודים של משרד החינוך (חשבון, חינוך לשוני, מדע וטכנולוגיה, כישורי חיים) ועדיין לא עברו אישור של מורה.</p>
        </>
      )}
    </div>
  );
}

function ValuesSection({ values }: { values?: Record<string, import('../data/db').ValueStat> }) {
  const sum = skillSummary(values ?? {});
  const rows = Object.entries(VALUE_SKILLS).filter(([id]) => sum[id]);
  return (
    <div className="card">
      <h3>הבנת מצבים</h3>
      {rows.length ? (
        <table className="nodes">
          <thead><tr><th>נושא</th><th>מצבים</th><th>הבין בבחירה הראשונה</th></tr></thead>
          <tbody>
            {rows.map(([id, name]) => (
              <tr key={id}><td>{name}</td><td>{sum[id].answered}</td><td>{Math.round((sum[id].best / sum[id].answered) * 100)}%</td></tr>
            ))}
          </tbody>
        </table>
      ) : <p className="muted">עוד לא ענו על שאלות מצב.</p>}
      <p className="muted small">הסדר של התשובות מתערבב בכל פעם, כך שאי אפשר לנחש לפי מיקום. נושא עם אחוז נמוך הוא הזמנה לשיחה, לא ציון. מצבים שלא הובנו חוזרים אחרי כמה ימים.</p>
    </div>
  );
}

function StorySection({ read }: { read?: Record<string, string> }) {
  const done = CHAPTERS.filter((c) => read?.[chapterKey(c)]);
  const last = done.at(-1);
  return (
    <div className="card">
      <h3>סיפור לילה</h3>
      {done.length ? (
        <>
          <p>נקראו {done.length} פרקים. האחרון: <b>{last!.title}</b></p>
          {last!.learning?.issue && <p>הנושא בפרק: {last!.learning.issue}</p>}
          {last!.learning?.parentNote && <p className="muted">{last!.learning.parentNote}</p>}
        </>
      ) : <p className="muted">עוד לא נקראו פרקים.</p>}
    </div>
  );
}

function PuzzlesSection({ puzzles }: { puzzles?: import('../data/db').PlayerDoc['puzzles'] }) {
  const w = puzzles?.words, m = puzzles?.math;
  if (!w?.solved && !m?.solved) return null;
  return (
    <div className="card">
      <h3>גן החידות</h3>
      <ul>
        {w?.solved ? <li>תפזורת מילים: נפתרו {w.solved}, רמה נוכחית {w.level} מתוך 3, רמזים {w.hints}</li> : null}
        {m?.solved ? <li>תפזורת תרגילים: נפתרו {m.solved}, רמה נוכחית {m.level} מתוך 3, תרגילים שגויים שסומנו {m.mistakes}</li> : null}
      </ul>
      <p className="muted small">בתפזורת התרגילים יש בכוונה תרגילים שגויים. סימון של תרגיל שגוי הוא הזדמנות לבדוק חישוב, והמשחק מראה מה התוצאה הנכונה.</p>
    </div>
  );
}

function SmarterSection() {
  const { player, updatePlayer } = useApp();
  const prog = player!.smarter ?? {};
  const today = dayKey(Date.now());
  const entries = Object.entries(prog).filter(([id]) => WORD_BY_ID.has(id));
  if (!entries.length) return null;
  const counts: Record<WordStatus, number> = { new: 0, shown: 0, practice: 0, known: 0 };
  for (const [, p] of entries) counts[wordStatus(p, today)]++;
  const known = entries.filter(([, p]) => p.usedDay);
  const removeRecording = async (wordId: string, rid: number) => {
    await deleteRecording(rid);
    updatePlayer((pl) => ({ ...pl, smarter: { ...(pl.smarter ?? {}), [wordId]: { ...pl.smarter![wordId], recordingId: undefined } } }));
  };
  return (
    <div className="card">
      <h3>חכמים יותר</h3>
      <p>{(['shown', 'practice', 'known'] as WordStatus[]).map((s) => `${STATUS_LABEL[s]}: ${counts[s]}`).join(' · ')}</p>
      {known.length > 0 && (
        <table className="nodes">
          <thead><tr><th>מילה</th><th>איפה השתמש/ה</th><th>הקלטה</th></tr></thead>
          <tbody>
            {known.map(([id, p]) => (
              <tr key={id}>
                <td><b>{WORD_BY_ID.get(id)!.word}</b></td>
                <td>{p.note ?? <span className="muted">-</span>}</td>
                <td>{p.recordingId ? <RecordingCell id={p.recordingId} onDelete={() => removeRecording(id, p.recordingId!)} /> : <span className="muted">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">מילה עוברת ל"בתרגול" אחרי שהילד ענה נכון על השאלות ביומיים שונים, ול"מכירים" רק כשסימן שהשתמש בה בחיים (מהיום השלישי). ההקלטות נשמרות רק במכשיר הזה ואפשר למחוק אותן כאן.</p>
    </div>
  );
}

function RecordingCell({ id, onDelete }: { id: number; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    getRecording(id).then((r) => { if (r) { u = URL.createObjectURL(r.blob); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return (
    <span className="row" style={{ justifyContent: 'flex-start' }}>
      {url && <audio controls src={url} style={{ maxWidth: 220 }} />}
      <button className="btn btn-ghost btn-sm" onClick={onDelete}>מחיקה</button>
    </span>
  );
}

function ServerDataSection() {
  const { player, setPlayer, go } = useApp();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const remove = async () => {
    setErr(null);
    try {
      await deleteAccount(pin);
      setPlayer(null);
      go('login');
    } catch (e) {
      setErr((e as ApiError)?.status === 401 ? 'הקוד לא נכון.' : 'אין חיבור לשרת כרגע.');
    }
  };
  return (
    <div className="card">
      <h3>הנתונים בשרת</h3>
      <p>בשרת נשמרים: השם ({player!.nickname}), בית הספר, הכיתה וההתקדמות במשחק. הקוד נשמר מוצפן. אף ילד אחר לא יכול לראות את הנתונים האלה, והם לא משותפים עם אף גורם. הקלטות קוליות נשארות רק במכשיר.</p>
      {!open ? (
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>מחיקת כל הנתונים של {player!.nickname}</button>
      ) : (
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <input className="input pin-input" style={{ maxWidth: 140 }} value={pin} inputMode="numeric" type="password" maxLength={4} placeholder="הקוד" onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="הקוד של הילד" />
          <button className="btn btn-pink btn-sm" disabled={pin.length !== 4} onClick={() => void remove()}>למחוק לצמיתות</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); setPin(''); }}>ביטול</button>
          {err && <span className="login-error">{err}</span>}
        </div>
      )}
    </div>
  );
}
