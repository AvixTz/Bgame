import { useEffect, useRef, useState } from 'react';
import { useApp } from '../core/store';
import { attemptsFor } from '../data/db';
import { buildReport, type ParentReport } from '../brain/insights';
import type { NodeStatus } from '../brain/model';

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
      <h2>👨‍👩‍👧 אזור הורים</h2>
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

          <div className="card">
            <h3>📚 מפת הנושאים (חשבון)</h3>
            <table className="nodes">
              <thead><tr><th>כיתה</th><th>נושא</th><th>מצב</th><th>רמה</th></tr></thead>
              <tbody>
                {report.nodes.map((n) => (
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

          <p className="privacy">🔒 כל הנתונים נשמרים רק במכשיר הזה. זו גרסה ניסיונית. הנושאים מבוססים על תוכנית הלימודים של משרד החינוך ועדיין לא עברו אישור של מורה.</p>
        </>
      )}
    </div>
  );
}
