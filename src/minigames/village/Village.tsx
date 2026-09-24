import { useState } from 'react';
import { Handshake, MessagesSquare, Sparkles, Volume2 } from 'lucide-react';
import { burst } from '../../ui/fx';
import { useApp } from '../../core/store';
import { g } from '../../core/rng';
import { sfx, speak } from '../../core/audio';
import { SCENARIOS, SKILLS, type Scenario } from './scenarios';
import { ValuesQuiz } from './ValuesQuiz';
import { VALUE_BANK, VALUE_SKILLS } from './valuesBank';

/** The Friends Village: social situations with choices and consequences. No score, no coins. */
export function Village({ onExit }: { onExit: () => void }) {
  const { player, updatePlayer } = useApp();
  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const [sc, setSc] = useState<Scenario | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [quiz, setQuiz] = useState<{ skill?: string } | null>(null);

  const visited = p.village ?? {};
  const skillsFound = new Set(
    Object.entries(visited).flatMap(([id, choices]) => {
      const s = SCENARIOS.find((x) => x.id === id);
      return s ? choices.map((c) => s.choices[Number(c)]?.skill).filter(Boolean) as string[] : [];
    }),
  );

  const choose = (i: number) => {
    if (!sc) return;
    sfx.tap();
    const next = [...picked, i];
    setPicked(next);
    updatePlayer((pl) => ({ ...pl, village: { ...(pl.village ?? {}), [sc.id]: [...new Set([...(pl.village?.[sc.id] ?? []), String(i)])] } }));
  };

  if (quiz) {
    return (
      <div className="screen mines world-village">
        <div className="mine-top">
          <button className="btn btn-ghost btn-sm" onClick={() => setQuiz(null)}>לכפר</button>
          <h2 className="mine-title"><MessagesSquare className="icon" /> שאלות מצב</h2>
          <span />
        </div>
        <ValuesQuiz skill={quiz.skill} onExit={() => setQuiz(null)} />
      </div>
    );
  }

  if (sc) {
    const last = picked[picked.length - 1];
    const choice = last !== undefined ? sc.choices[last] : null;
    return (
      <div className="screen mines world-village">
        <div className="mine-top">
          <button className="btn btn-ghost btn-sm" onClick={() => { setSc(null); setPicked([]); setDone(false); }}>לכפר</button>
          <h2 className="mine-title">{sc.who} {sc.title}</h2>
          <span />
        </div>
        <div className="card scenario">
          <span className="scene-who" aria-hidden>{sc.who}</span>
          <p className="situation">{G(sc.situation)} <button className="icon-btn inline" onClick={() => speak(G(sc.situation))} aria-label="הקראה"><Volume2 className="icon" /></button></p>
          {!done && <p className="q-prompt">{G('מה היית עושה?')}</p>}
          {!done && (
            <div className="choices one-col">
              {sc.choices.map((c, i) => (
                <button key={i} className={`choice ${picked.includes(i) ? 'on' : ''}`} onClick={() => choose(i)}>{G(c.text)}</button>
              ))}
            </div>
          )}
          {choice && (
            <div className="outcome">
              <span className="feeling">{choice.feeling}</span>
              <p>{G(choice.outcome)}</p>
              {choice.skill && <p className="skill-found"><Sparkles className="icon" /> {G('השתמשת בכלי')}: <b>{SKILLS[choice.skill]}</b></p>}
            </div>
          )}
          {choice && !done && (
            <div className="row">
              <button className="btn btn-ghost" onClick={() => setPicked((x) => x.slice(0, -1).concat())}>{G('לנסות בחירה אחרת')}</button>
              <button className="btn btn-yellow" onClick={() => { setDone(true); sfx.correct(); burst(); }}>{G('סיימתי')}</button>
            </div>
          )}
          {done && (
            <div className="lookback">
              <h3>הינשוף החכם שואל</h3>
              <p>{G('איזו בחירה הרגישה לך הכי טוב? למה?')}</p>
              <p className="muted">{G('שאלה לשיחה בבית:')} {G(sc.home)}</p>
              <button className="btn btn-pink" onClick={() => { setSc(null); setPicked([]); setDone(false); }}>חזרה לכפר</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen mines world-village">
      <div className="mine-top">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>חזרה לאי</button>
        <h2 className="mine-title"><Handshake className="icon" /> כפר החברים</h2>
        <span />
      </div>
      <div className="card lobby-hero village-hero">
        <p>{G('בכפר גרים חברים שצריכים את העזרה שלך. אין כאן ציונים. יש בחירות, ומה שקורה אחריהן.')}</p>
        <div className="strats">
          {Object.entries(SKILLS).map(([id, name]) => (
            <span key={id} className={`strat ${skillsFound.has(id) ? 'got' : 'missing'}`}>{skillsFound.has(id) ? name : '❔ כלי שעוד לא נמצא'}</span>
          ))}
        </div>
      </div>
      <div className="card values-hero">
        <h3><MessagesSquare className="icon" /> שאלות מצב</h3>
        <p>{G('סבב של 8 מצבים מהחיים. קרא{|י} כל מצב עד הסוף ובחר{|י} מה הכי כדאי לעשות.')} <span className="muted">({VALUE_BANK.length} מצבים במאגר)</span></p>
        <button className="btn btn-pink" onClick={() => { sfx.tap(); setQuiz({}); }}>{G('התחל{|י} סבב')}</button>
        <div className="strats values-skills">
          {Object.entries(VALUE_SKILLS).map(([id, name]) => (
            <button key={id} className="strat" onClick={() => { sfx.tap(); setQuiz({ skill: id }); }}>{name}</button>
          ))}
        </div>
      </div>
      <h3 className="section-title">סיפורי הכפר</h3>
      <div className="tunnels">
        {SCENARIOS.map((s) => (
          <button key={s.id} className={`tunnel ${visited[s.id] ? 'st-mastered' : 'st-new'}`} onClick={() => { sfx.tap(); setSc(s); }}>
            <span className="t-icon">{s.who}</span>
            <span className="t-name">{s.title}</span>
            <span className="t-state">{visited[s.id] ? 'ביקרת ✓' : 'חדש'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
