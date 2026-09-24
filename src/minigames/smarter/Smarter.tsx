import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen, Brain, CalendarCheck, Check, Coins, Flag, FlaskConical, GraduationCap, Heart, Lightbulb, MessageCircle,
  Mic, Palette, Play, Search, Smile, Sprout, Square, Trash2, Users, Volume2, Wrench, type LucideIcon,
} from 'lucide-react';
import { CoinPill } from '../../ui/Hud';
import { burst, celebrate } from '../../ui/fx';
import { useApp } from '../../core/store';
import { g, shuffle } from '../../core/rng';
import { sfx, speak, speakParagraphs } from '../../core/audio';
import { dayKey } from '../../economy/economy';
import { getRecording, saveRecording } from '../../data/db';
import { DOMAINS, WORDS, WORD_BY_ID, WORD_BY_TEXT, plainStory, rtlPicture, storyParts, type SmartWord } from './wordBank';
import { STATUS_LABEL, canMarkUsed, dayDiff, dueToday, nextStep, quizPassed, wordStatus, type WordProgress, type WordStatus } from './progress';

const ICONS: Record<string, LucideIcon> = {
  coins: Coins, brain: Brain, search: Search, wrench: Wrench, calendar: CalendarCheck, flag: Flag, message: MessageCircle,
  users: Users, sprout: Sprout, smile: Smile, heart: Heart, flask: FlaskConical, palette: Palette,
};
const QUIZ_COINS = 2;
const USED_COINS = 5;

function StatusBadge({ s }: { s: WordStatus }) {
  return <span className={`wstatus ws-${s}`}>{STATUS_LABEL[s]}</span>;
}

/** "חכמים יותר": richer words by domain. Learn, answer, practice over days, then use it in real life. */
export function Smarter({ onExit }: { onExit: () => void }) {
  const { player } = useApp();
  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const today = dayKey(Date.now());
  const prog = p.smarter ?? {};
  const [domain, setDomain] = useState<string | null>(null);
  const [wordId, setWordId] = useState<string | null>(null);
  const status = (w: SmartWord) => wordStatus(prog[w.id], today);
  const counts = useMemo(() => {
    const c: Record<WordStatus, number> = { new: 0, shown: 0, practice: 0, known: 0 };
    for (const w of WORDS) c[wordStatus(prog[w.id], today)]++;
    return c;
  }, [prog, today]);
  const due = WORDS.filter((w) => dueToday(prog[w.id], today));

  const word = wordId ? WORD_BY_ID.get(wordId) : null;
  const back = () => { if (word) setWordId(null); else if (domain) setDomain(null); else onExit(); };

  return (
    <div className="screen mines world-smarter">
      <div className="mine-top">
        <button className="btn btn-ghost btn-sm" onClick={back}>{word ? (domain ? 'לתחום' : 'לחכמים יותר') : domain ? 'לכל התחומים' : 'חזרה לאי'}</button>
        <h2 className="mine-title"><GraduationCap className="icon" /> חכמים יותר</h2>
        <CoinPill value={p.coins} />
      </div>

      {word && <WordPage key={word.id} w={word} onOpen={(id) => setWordId(id)} />}

      {!word && !domain && (
        <>
          <div className="card smarter-hero">
            <p>{G('מילים חכמות שמבוגרים משתמשים בהן, ועכשיו גם את{ה|}. בוחרים מילה, מכירים אותה דרך סיפור קצר, עונים על כמה שאלות, ואחרי כמה ימים משתמשים בה בחיים.')}</p>
            <div className="status-row">
              {(['new', 'shown', 'practice', 'known'] as WordStatus[]).map((s) => (
                <span key={s} className={`status-count ws-${s}`}><b>{counts[s]}</b> {STATUS_LABEL[s]}</span>
              ))}
            </div>
          </div>
          {due.length > 0 && (
            <div className="card today-words">
              <h3><CalendarCheck className="icon" /> {G('מחכות לך היום')}</h3>
              <div className="word-chips">
                {due.map((w) => (
                  <button key={w.id} className="word-chip" onClick={() => { sfx.tap(); setWordId(w.id); }}>
                    <b>{w.word}</b> <small>{G(nextStep(prog[w.id], today))}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="domain-grid">
            {DOMAINS.map((d) => {
              const ws = WORDS.filter((w) => w.domain === d.id);
              if (!ws.length) return null;
              const Icon = ICONS[d.icon] ?? Lightbulb;
              const known = ws.filter((w) => status(w) === 'known').length;
              const started = ws.filter((w) => status(w) !== 'new').length;
              return (
                <button key={d.id} className="card domain-card" onClick={() => { sfx.tap(); setDomain(d.id); }}>
                  <Icon className="icon domain-ico" />
                  <b>{d.name}</b>
                  <span className="muted small">{ws.length} מילים · הכרת {started} · מכירים {known}</span>
                  <span className="dbar" aria-hidden><span style={{ width: `${(started / ws.length) * 100}%` }} /><span className="k" style={{ width: `${(known / ws.length) * 100}%` }} /></span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {!word && domain && (
        <div className="word-grid">
          {WORDS.filter((w) => w.domain === domain).map((w) => (
            <button key={w.id} className={`card word-card st-${status(w)}`} onClick={() => { sfx.tap(); setWordId(w.id); }}>
              <span className="word-emoji" aria-hidden>{rtlPicture(w.picture.emoji)}</span>
              <b className="word-title">{w.word}</b>
              <StatusBadge s={status(w)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Step = 'learn' | 'quiz' | 'done' | 'use';

function WordPage({ w, onOpen }: { w: SmartWord; onOpen: (id: string) => void }) {
  const { player, updatePlayer, showToast } = useApp();
  const p = player!;
  const G = (t: string) => g(t, p.gender);
  const today = dayKey(Date.now());
  const prog = p.smarter?.[w.id];
  const s = wordStatus(prog, today);
  const [step, setStep] = useState<Step>('learn');
  const [reading, setReading] = useState(false);
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);

  const save = (f: (cur: WordProgress | undefined) => WordProgress, coins = 0) =>
    updatePlayer((pl) => ({ ...pl, coins: pl.coins + coins, smarter: { ...(pl.smarter ?? {}), [w.id]: f(pl.smarter?.[w.id]) } }));

  const startQuiz = () => {
    stop.current(); setReading(false);
    if (!prog) save(() => ({ shownDay: today, passDays: [] }));
    setStep('quiz');
  };
  const readStory = () => {
    if (reading) { stop.current(); setReading(false); return; }
    setReading(true);
    stop.current = speakParagraphs([w.story.title, plainStory(w.story.text)], () => {}, () => setReading(false));
  };
  const days = prog ? dayDiff(today, prog.shownDay) : 0;

  return (
    <div className="card word-page">
      <div className="word-head">
        <h1 className="big-word">{w.word}</h1>
        <button className="icon-btn" onClick={() => speak(`${w.word}. ${w.meaning}`)} aria-label="הקראה"><Volume2 className="icon" /></button>
        <StatusBadge s={s} />
      </div>

      {step === 'learn' && (
        <>
          <p className="word-meaning">{w.meaning}</p>
          <div className="word-picture" aria-hidden><span className="pic-emoji">{rtlPicture(w.picture.emoji)}</span><span className="pic-cap">{w.picture.caption}</span></div>
          <p className="word-explain">{w.explain}</p>
          <div className="mini-story">
            <div className="ms-head"><BookOpen className="icon" /> <b>{w.story.title}</b>
              <button className="btn btn-ghost btn-sm" onClick={readStory}>{reading ? <><Square className="icon" /> עצירה</> : <><Play className="icon" /> {G('הקרא לי')}</>}</button>
            </div>
            <p>{storyParts(w.story.text).map((part, i) => (part.mark ? <mark key={i}>{part.t}</mark> : <span key={i}>{part.t}</span>))}</p>
          </div>
          {w.related?.length ? (
            <p className="related">מילים קרובות: {w.related.map((r) => {
              const rw = WORD_BY_TEXT.get(r);
              return rw ? <button key={r} className="chip" onClick={() => onOpen(rw.id)}>{r}</button> : <span key={r} className="chip">{r}</span>;
            })}</p>
          ) : null}
          <Journey prog={prog} today={today} />
          <div className="row">
            <button className="btn btn-yellow btn-lg" onClick={startQuiz}>{prog?.passDays.includes(today) ? G('לתרגל שוב') : G('הבנתי, לשאלות')}</button>
            {canMarkUsed(prog, today) && <button className="btn btn-pink btn-lg" onClick={() => setStep('use')}><Sprout className="icon" /> {G('השתמשתי במילה!')}</button>}
          </div>
        </>
      )}

      {step === 'quiz' && (
        <WordQuiz w={w} onEnd={(first, total) => {
          const ok = quizPassed(first, total);
          const firstToday = !prog?.passDays.includes(today);
          if (ok) {
            save((cur) => ({ ...(cur ?? { shownDay: today, passDays: [] }), passDays: [...new Set([...(cur?.passDays ?? []), today])] }), firstToday ? QUIZ_COINS : 0);
            if (firstToday) setTimeout(sfx.coin, 200);
            celebrate();
          }
          setStep('done');
          showToast(ok ? G(`עברת! ${first} מתוך ${total} בניסיון הראשון`) : G(`${first} מתוך ${total} בניסיון הראשון. אפשר לקרוא שוב את הסיפור ולנסות`));
        }} />
      )}

      {step === 'done' && (
        <>
          <Journey prog={p.smarter?.[w.id]} today={today} />
          <p className="next-step"><Lightbulb className="icon" /> {G(nextStep(p.smarter?.[w.id], today))}</p>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep('learn')}>חזרה למילה</button>
            {canMarkUsed(p.smarter?.[w.id], today) && <button className="btn btn-pink" onClick={() => setStep('use')}><Sprout className="icon" /> {G('השתמשתי במילה!')}</button>}
          </div>
        </>
      )}

      {step === 'use' && (
        <UseForm w={w} prompt={G(w.realLife)} onSave={(note, recordingId) => {
          save((cur) => ({ ...cur!, usedDay: today, note: note || undefined, recordingId }), USED_COINS);
          sfx.win(); celebrate(); setTimeout(sfx.coin, 300);
          showToast(G(`"${w.word}" עכשיו מילה שלך!`));
          setStep('learn');
        }} onCancel={() => setStep('learn')} />
      )}

      {s === 'known' && step === 'learn' && prog && <UsedMemory prog={prog} />}
      {s !== 'new' && step === 'learn' && <p className="muted small center">{days === 0 ? 'הכרת את המילה היום' : `הכרת את המילה לפני ${days} ${days === 1 ? 'יום' : 'ימים'}`}</p>}
    </div>
  );
}

/** The four statuses as a path, with the current one highlighted. */
function Journey({ prog, today }: { prog?: WordProgress; today: string }) {
  const s = wordStatus(prog, today);
  const steps: { id: WordStatus; hint: string }[] = [
    { id: 'new', hint: 'עוד לא פתחת' },
    { id: 'shown', hint: 'יומיים ראשונים' },
    { id: 'practice', hint: 'עברת שאלות ביומיים שונים' },
    { id: 'known', hint: 'השתמשת בחיים' },
  ];
  const idx = steps.findIndex((x) => x.id === s);
  return (
    <ol className="journey" aria-label="השלב של המילה">
      {steps.map((x, i) => (
        <li key={x.id} className={`${i < idx ? 'past' : ''} ${i === idx ? 'now' : ''}`}>
          <span className="dot">{i < idx ? <Check className="icon" /> : i + 1}</span>
          <b>{STATUS_LABEL[x.id]}</b>
          <small>{x.hint}</small>
        </li>
      ))}
    </ol>
  );
}

function WordQuiz({ w, onEnd }: { w: SmartWord; onEnd: (firstTryCorrect: number, total: number) => void }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const questions = useMemo(() => shuffle(Math.random, w.questions.map((q) => ({ ...q, order: shuffle(Math.random, q.options.map((_, i) => i)) }))), [w]);
  const [i, setI] = useState(0);
  const [tried, setTried] = useState<number[]>([]);
  const [first, setFirst] = useState(0);
  const q = questions[i];
  const solved = tried.includes(q.answer);

  const pick = (o: number) => {
    if (solved || tried.includes(o)) return;
    if (tried.length === 0 && o === q.answer) setFirst((f) => f + 1);
    setTried((t) => [...t, o]);
    if (o === q.answer) { sfx.correct(); burst(0.5, 0.5); } else sfx.wrong();
  };
  const next = () => {
    if (i + 1 >= questions.length) { onEnd(first, questions.length); return; }
    setI(i + 1); setTried([]);
  };

  return (
    <div className="word-quiz">
      <div className="values-meta"><span className="muted">{G('שאלה')} <bdi dir="ltr">{i + 1}/{questions.length}</bdi></span></div>
      <p className="q-prompt">{q.q}</p>
      <div className="choices one-col">
        {q.order.map((o) => {
          const was = tried.includes(o);
          return <button key={o} className={`choice ${was ? (o === q.answer ? 'right' : 'wrong') : ''}`} disabled={solved || was} onClick={() => pick(o)}>{q.options[o]}</button>;
        })}
      </div>
      {tried.length > 0 && !solved && <p className="muted">{G('לא בדיוק. נסה{|י} תשובה אחרת.')}</p>}
      {solved && (
        <>
          <p className="outcome q-best">{q.why}</p>
          <div className="row"><button className="btn btn-yellow" onClick={next} autoFocus>{i + 1 < questions.length ? 'המשך' : G('סיימתי')}</button></div>
        </>
      )}
    </div>
  );
}

/** Optional note and/or voice recording about where the child used the word. */
function UseForm({ w, prompt, onSave, onCancel }: { w: SmartWord; prompt: string; onSave: (note: string, recordingId?: number) => void; onCancel: () => void }) {
  const { player } = useApp();
  const G = (t: string) => g(t, player!.gender);
  const [note, setNote] = useState('');
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setBlob(new Blob(chunks, { type: r.mimeType || 'audio/webm' })); setRec(null); };
      r.start();
      setRec(r);
      setTimeout(() => { if (r.state === 'recording') r.stop(); }, 60_000);
    } catch {
      setErr('לא הצלחנו להשתמש במיקרופון. אפשר לכתוב במקום.');
    }
  };
  const submit = async () => {
    let id: number | undefined;
    if (blob) id = await saveRecording({ playerId: player!.id, wordId: w.id, blob, mime: blob.type, at: Date.now() });
    onSave(note.trim(), id);
  };

  return (
    <div className="use-form">
      <h3><Sprout className="icon" /> {G('איפה השתמשת במילה')} "{w.word}"?</h3>
      <p className="muted">{prompt}</p>
      <label className="field">
        <span>{G('אפשר לכתוב (לא חובה)')}</span>
        <textarea className="input" rows={3} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} placeholder={G('למשל: בהפסקה אמרתי לחבר ש...')} />
      </label>
      {canRecord && (
        <div className="recorder">
          {!rec && !blob && <button className="btn btn-ghost" onClick={start}><Mic className="icon" /> {G('להקליט (לא חובה)')}</button>}
          {rec && <button className="btn btn-pink rec-on" onClick={() => rec.stop()}><Square className="icon" /> {G('עצור הקלטה')}</button>}
          {blob && url && (
            <>
              <audio controls src={url} />
              <button className="icon-btn" onClick={() => setBlob(null)} aria-label="מחיקת ההקלטה"><Trash2 className="icon" /></button>
            </>
          )}
          <p className="muted small">ההקלטה נשמרת רק במכשיר הזה.</p>
        </div>
      )}
      {err && <p className="muted">{err}</p>}
      <div className="row">
        <button className="btn btn-ghost" onClick={onCancel}>ביטול</button>
        <button className="btn btn-yellow btn-lg" onClick={submit} disabled={!!rec}><Check className="icon" /> {G('סמן{|י}: השתמשתי')}</button>
      </div>
    </div>
  );
}

function UsedMemory({ prog }: { prog: WordProgress }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    if (prog.recordingId) getRecording(prog.recordingId).then((r) => { if (r) { u = URL.createObjectURL(r.blob); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [prog.recordingId]);
  if (!prog.note && !prog.recordingId) return null;
  return (
    <div className="used-memory">
      <b>איפה השתמשת במילה:</b>
      {prog.note && <p>{prog.note}</p>}
      {url && <audio controls src={url} />}
    </div>
  );
}

