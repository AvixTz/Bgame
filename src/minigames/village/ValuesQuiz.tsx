import { useMemo, useState } from 'react';
import { Heart, Lightbulb, Volume2 } from 'lucide-react';
import { burst, celebrate } from '../../ui/fx';
import { useApp } from '../../core/store';
import { g } from '../../core/rng';
import { sfx, speak } from '../../core/audio';
import { VALUE_BANK, VALUE_SKILLS, pickRound, shuffledOptions, type ValueItem, type ValueOption } from './valuesBank';

const ROUND = 8;

/**
 * A round of values situations. Options are reshuffled on every showing and carry no numbers, so
 * the only way to the good answer is reading the situation. A weaker choice shows what happens
 * and the child tries again; the first choice is what the parent area reports.
 */
export function ValuesQuiz({ skill, onExit }: { skill?: string; onExit: () => void }) {
  const { player, updatePlayer } = useApp();
  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const [round] = useState<ValueItem[]>(() => pickRound(VALUE_BANK, p.values ?? {}, ROUND, Math.random, Date.now(), skill));
  const [idx, setIdx] = useState(0);
  const [tried, setTried] = useState<ValueOption[]>([]);
  const [firstBest, setFirstBest] = useState(0);
  const item = round[idx];
  const options = useMemo(() => (item ? shuffledOptions(item, Math.random) : []), [item]);
  const last = tried[tried.length - 1];
  const solved = last?.quality === 'best';

  const choose = (o: ValueOption) => {
    if (solved || tried.includes(o)) return;
    if (tried.length === 0) {
      if (o.quality === 'best') setFirstBest((n) => n + 1);
      updatePlayer((pl) => {
        const prev = pl.values?.[item.id];
        return { ...pl, values: { ...(pl.values ?? {}), [item.id]: { seen: (prev?.seen ?? 0) + 1, lastAt: Date.now(), first: o.quality } } };
      });
    }
    setTried((t) => [...t, o]);
    if (o.quality === 'best') { sfx.correct(); burst(); } else sfx.tap();
  };

  const next = () => {
    setTried([]);
    setIdx((i) => i + 1);
    if (idx + 1 >= round.length) { sfx.win(); celebrate(); }
  };

  if (!item) {
    return (
      <div className="card scenario values-end">
        <Heart className="icon icon-xl" />
        <h3>{G('סיימת סבב!')}</h3>
        <p>{G('הבנת')} <b>{firstBest}</b> {G('מצבים מתוך')} {round.length} {G('כבר בבחירה הראשונה.')}</p>
        <p className="muted">{G('שאלה לשיחה בבית: איזה מצב היום הזכיר לך משהו שקרה לך?')}</p>
        <div className="row">
          <button className="btn btn-pink" onClick={onExit}>חזרה לכפר</button>
        </div>
      </div>
    );
  }

  const read = `${item.situation} ${item.question}`;
  return (
    <div className="card scenario values-q" key={item.id}>
      <div className="values-meta">
        <span className="strat">{VALUE_SKILLS[item.skill] ?? item.skill}</span>
        <span className="muted"><bdi dir="ltr">{idx + 1}/{round.length}</bdi></span>
      </div>
      <p className="situation">{item.situation} <button className="icon-btn inline" onClick={() => speak(read)} aria-label="הקראה"><Volume2 className="icon" /></button></p>
      <p className="q-prompt">{item.question}</p>
      <div className="choices one-col">
        {options.map((o) => {
          const was = tried.includes(o);
          const cls = was ? (o.quality === 'best' ? 'right' : o.quality === 'ok' ? 'meh' : 'wrong') : '';
          return (
            <button key={o.text} className={`choice ${cls}`} disabled={solved || was} onClick={() => choose(o)}>{o.text}</button>
          );
        })}
      </div>
      {last && (
        <div className={`outcome q-${last.quality}`} aria-live="polite">
          <p>{last.feedback}</p>
          {last.quality === 'ok' && <p className="muted"><Lightbulb className="icon" /> {G('זה לא רע, אבל יש בחירה שעוזרת עוד יותר. נסה{|י} למצוא אותה.')}</p>}
          {last.quality === 'poor' && <p className="muted">{G('בוא{|י} ננסה בחירה אחרת.')}</p>}
        </div>
      )}
      {solved && (
        <div className="row">
          {item.home && <p className="muted home-q">{G('לשיחה בבית:')} {item.home}</p>}
          <button className="btn btn-yellow" onClick={next}>{idx + 1 < round.length ? 'המשך' : G('סיימתי')}</button>
        </div>
      )}
    </div>
  );
}
