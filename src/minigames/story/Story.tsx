import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Minus, Moon, Pause, Play, Plus, Star } from 'lucide-react';
import { useApp } from '../../core/store';
import { g, shuffle } from '../../core/rng';
import { sfx, speakParagraphs } from '../../core/audio';
import { dayKey } from '../../economy/economy';
import { burst } from '../../ui/fx';
import { STORIES, chapterKey, nextChapter, openChapters, tonight, type Chapter, type StoryQuestion } from './storyBank';

const SIZE_KEY = 'bgame.storySize';
const readSize = () => { try { return Number(localStorage.getItem(SIZE_KEY)) || 1; } catch { return 1; } };

/** "סיפור לילה": one chapter a night, read aloud with the current paragraph highlighted. */
export function Story({ onExit }: { onExit: () => void }) {
  const { player, updatePlayer } = useApp();
  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const today = dayKey(Date.now());
  const read = p.storyRead ?? {};
  const [open, setOpen] = useState<Chapter | null>(null);
  const tonightCh = tonight(today, read);
  const archive = openChapters(today).slice().reverse();
  const upcoming = nextChapter(today);

  if (open) return <Reader ch={open} onBack={() => setOpen(null)} onRead={() => updatePlayer((pl) => ({ ...pl, storyRead: { ...(pl.storyRead ?? {}), [chapterKey(open)]: today } }))} />;

  return (
    <div className="screen story-screen">
      <NightSky />
      <div className="mine-top">
        <button className="btn btn-ghost btn-sm" onClick={onExit}>חזרה לאי</button>
        <h2 className="mine-title"><Moon className="icon" /> סיפור לילה</h2>
        <span />
      </div>
      {tonightCh ? (
        <button className="card story-tonight" onClick={() => { sfx.tap(); setOpen(tonightCh); }}>
          <span className="story-kicker">{read[chapterKey(tonightCh)] ? G('קראת כבר את הפרק של הלילה') : 'הפרק של הלילה'}</span>
          <span className="story-title">{tonightCh.title}</span>
          <span className="muted">{STORIES.find((s) => s.id === tonightCh.story)?.title} · פרק {tonightCh.number}</span>
          <span className="btn btn-yellow"><BookOpen className="icon" /> {G('לקרוא')}</span>
        </button>
      ) : <div className="card story-tonight"><p>{G('הפרק הראשון עוד בדרך. תחזר{|י} בקרוב!')}</p></div>}
      {upcoming && <p className="story-next">{G('הפרק הבא נפתח ב־')}<bdi dir="ltr">{upcoming.publishDate.split('-').reverse().join('.')}</bdi></p>}
      {archive.length > 1 && (
        <>
          <h3 className="section-title story-section">כל הפרקים</h3>
          <div className="story-list">
            {archive.map((c) => (
              <button key={chapterKey(c)} className="story-row" onClick={() => { sfx.tap(); setOpen(c); }}>
                <span className="story-num">{c.number}</span>
                <span className="story-row-title">{c.title}</span>
                {read[chapterKey(c)] ? <Check className="icon" aria-label="נקרא" /> : <Star className="icon" aria-label="חדש" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Reader({ ch, onBack, onRead }: { ch: Chapter; onBack: () => void; onRead: () => void }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const [size, setSize] = useState(readSize);
  const [reading, setReading] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const stop = useRef<() => void>(() => {});
  const refs = useRef<(HTMLParagraphElement | null)[]>([]);

  useEffect(() => () => stop.current(), []);
  useEffect(() => { try { localStorage.setItem(SIZE_KEY, String(size)); } catch { /* ignore */ } }, [size]);
  useEffect(() => { if (reading >= 0) refs.current[reading]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [reading]);

  const toggle = () => {
    if (playing) { stop.current(); setPlaying(false); return; }
    setPlaying(true);
    stop.current = speakParagraphs(ch.paragraphs, setReading, () => setPlaying(false));
  };
  const finish = () => { stop.current(); setPlaying(false); setFinished(true); onRead(); sfx.win(); burst(); };

  return (
    <div className="screen story-screen">
      <NightSky />
      <div className="mine-top">
        <button className="btn btn-ghost btn-sm" onClick={() => { stop.current(); onBack(); }}>לכל הפרקים</button>
        <h2 className="mine-title">פרק {ch.number}</h2>
        <span />
      </div>
      <article className="card story-page" style={{ ['--story-size' as string]: size }}>
        <h1 className="story-h">{ch.title}</h1>
        <div className="story-tools">
          <button className="btn btn-yellow btn-sm" onClick={toggle}>{playing ? <><Pause className="icon" /> עצירה</> : <><Play className="icon" /> {G('הקרא לי')}</>}</button>
          <span className="story-size">
            <button className="icon-btn" onClick={() => setSize((s) => Math.max(0.85, +(s - 0.15).toFixed(2)))} aria-label="טקסט קטן יותר"><Minus className="icon" /></button>
            <span aria-hidden>א</span>
            <button className="icon-btn" onClick={() => setSize((s) => Math.min(1.6, +(s + 0.15).toFixed(2)))} aria-label="טקסט גדול יותר"><Plus className="icon" /></button>
          </span>
        </div>
        {ch.paragraphs.map((t, i) => (
          <p key={i} ref={(el) => { refs.current[i] = el; }} className={`story-p ${reading === i ? 'now' : ''}`}>{t}</p>
        ))}
        {!finished ? (
          <button className="btn btn-pink story-done" onClick={finish}><Moon className="icon" /> {G('סיימתי לקרוא')}</button>
        ) : (
          <GoodNight ch={ch} />
        )}
      </article>
    </div>
  );
}

function GoodNight({ ch }: { ch: Chapter }) {
  const qs = ch.learning?.questions ?? [];
  return (
    <div className="lookback story-gn">
      <h3><Moon className="icon" /> שאלת לילה טוב</h3>
      {qs.length ? qs.map((q, i) => <NightQuestion key={i} q={q} />) : <p>מה הכי אהבת בפרק הזה?</p>}
    </div>
  );
}

function NightQuestion({ q }: { q: StoryQuestion }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const order = useMemo(() => (q.options ? shuffle(Math.random, q.options.map((_, i) => i)) : []), [q]);
  const [tried, setTried] = useState<number[]>([]);
  const solved = q.answer !== undefined && tried.includes(q.answer);
  if (!q.options) return <p className="story-open-q">{q.question}</p>;
  return (
    <div className="story-q">
      <p>{q.question}</p>
      <div className="choices one-col">
        {order.map((i) => {
          const was = tried.includes(i);
          return (
            <button key={i} disabled={solved || was} className={`choice ${was ? (i === q.answer ? 'right' : 'wrong') : ''}`}
              onClick={() => { setTried((t) => [...t, i]); if (i === q.answer) sfx.correct(); else sfx.tap(); }}>{q.options![i]}</button>
          );
        })}
      </div>
      {tried.length > 0 && !solved && <p className="muted">{G('נסה{|י} שוב, אפשר לחזור לסיפור ולחפש.')}</p>}
    </div>
  );
}

function NightSky() {
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % 100, y: (i * 53) % 70, d: (i % 5) * 0.6, s: 2 + (i % 3) })), []);
  return (
    <div className="night-sky" aria-hidden>
      {stars.map((s, i) => <span key={i} style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />)}
    </div>
  );
}

