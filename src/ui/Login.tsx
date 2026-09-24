import { useState } from 'react';
import { KeyRound, LogIn, School, UserPlus } from 'lucide-react';
import { useApp } from '../core/store';
import { newPlayer, savePlayer, type PlayerDoc } from '../data/db';
import { login, register, type ApiError, type Session } from '../data/remote';
import { SHOP } from '../economy/economy';
import type { Grade } from '../brain/types';
import type { Gender } from '../core/rng';
import { sfx } from '../core/audio';

const FREE_COLORS = SHOP.filter((s) => s.kind === 'color' && s.price === 0);
const LAST = 'bgame.lastLogin';
const readLast = (): { name: string; school: string } => { try { return JSON.parse(localStorage.getItem(LAST) ?? '') ?? { name: '', school: '' }; } catch { return { name: '', school: '' }; } };
const saveLast = (name: string, school: string) => { try { localStorage.setItem(LAST, JSON.stringify({ name, school })); } catch { /* storage blocked */ } };

/** Builds the player from what the server returned, filling any field a newer game version added. */
export function playerFromSession(s: Session): PlayerDoc {
  const d = s.doc ?? {};
  const base = newPlayer(s.player.name, (d.gender as Gender) ?? 'm', (d.grade as Grade) ?? 2, d.color ?? FREE_COLORS[0].value);
  return { ...base, ...d, id: s.player.id, nickname: s.player.name } as PlayerDoc;
}

function message(e: unknown): string {
  const err = e as ApiError;
  switch (err?.error) {
    case 'wrong': return err.left !== undefined && err.left <= 2 ? `השם, בית הספר או הקוד לא נכונים. נשארו ${err.left} ניסיונות.` : 'השם, בית הספר או הקוד לא נכונים.';
    case 'locked': return `יותר מדי ניסיונות. אפשר לנסות שוב בעוד ${err.retryInMin ?? 15} דקות, או לבקש ממבוגר לאפס את הקוד.`;
    case 'slow_down': return 'יותר מדי ניסיונות מהמכשיר הזה. נסו שוב בעוד שעה.';
    case 'taken': return 'כבר יש ילד עם השם הזה בבית הספר הזה. הוסיפו אות ראשונה של שם המשפחה, למשל "נועה כ".';
    case 'name': return 'השם צריך להיות באותיות, 2 עד 30 תווים.';
    case 'school': return 'שם בית הספר צריך להיות באותיות, 2 עד 60 תווים.';
    case 'pin_format': return 'הקוד צריך להיות 4 ספרות.';
    case 'pin_weak': return 'הקוד קל מדי לניחוש (כמו 1234 או 1111). בחרו קוד אחר.';
    default: return 'אין חיבור לשרת כרגע. נסו שוב בעוד רגע.';
  }
}

export function Login() {
  const { setPlayer, go } = useApp();
  const last = readLast();
  const [mode, setMode] = useState<'login' | 'register'>(last.name ? 'login' : 'register');
  const [name, setName] = useState(last.name);
  const [school, setSchool] = useState(last.school);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [gender, setGender] = useState<Gender>('m');
  const [grade, setGrade] = useState<Grade>(2);
  const [color, setColor] = useState(FREE_COLORS[0].value);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<Session | null>(null);

  const enter = async (s: Session) => {
    const p = playerFromSession(s);
    await savePlayer(p);
    setPlayer(p);
    sfx.tap();
    go('world');
  };

  const submit = async () => {
    setErr(null);
    if (mode === 'register' && pin !== pin2) { setErr('שני הקודים לא זהים.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        const s = await login({ name, school, pin });
        saveLast(s.player.name, s.player.school);
        await enter(s);
      } else {
        const doc = newPlayer(name.trim(), gender, grade, color);
        const s = await register({ name, school, pin, doc });
        saveLast(s.player.name, s.player.school);
        setCard(s);
      }
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4);
  const ready = name.trim().length >= 2 && school.trim().length >= 2 && pin.length === 4 && (mode === 'login' || pin2.length === 4);

  if (card) {
    return (
      <div className="screen profiles">
        <div className="card login-card">
          <h2><KeyRound className="icon" /> כרטיס הכניסה שלך</h2>
          <p>כדאי שהורה יצלם או ירשום את זה. בפעם הבאה נכנסים עם שלושת הפרטים האלה:</p>
          <dl className="login-ticket">
            <dt>שם</dt><dd>{card.player.name}</dd>
            <dt>בית ספר</dt><dd>{card.player.school}</dd>
            <dt>קוד</dt><dd>הקוד בן 4 הספרות שבחרת (הוא סודי, לא מופיע כאן)</dd>
          </dl>
          <button className="btn btn-pink btn-lg" onClick={() => void enter(card)}>יוצאים לדרך!</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen profiles">
      <header className="brand">
        <h1>Bgame <span>אי המוח</span></h1>
        <p>עולם של חשבון וחשיבה לכיתות ב'-ג'</p>
      </header>
      <div className="card login-card">
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(null); }}><LogIn className="icon" /> כבר נרשמתי</button>
          <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr(null); }}><UserPlus className="icon" /> פעם ראשונה</button>
        </div>

        <label className="field">
          <span>השם שלך</span>
          <input className="input" value={name} maxLength={30} autoComplete="username" onChange={(e) => setName(e.target.value)} placeholder="שם פרטי ואות משם המשפחה, למשל: נועה כ" />
        </label>
        <label className="field">
          <span><School className="icon" /> בית הספר</span>
          <input className="input" value={school} maxLength={60} autoComplete="organization" onChange={(e) => setSchool(e.target.value)} placeholder="למשל: הדר, רמת גן" />
        </label>
        <label className="field">
          <span>{mode === 'register' ? 'בחרו קוד סודי של 4 ספרות' : 'הקוד הסודי'}</span>
          <input className="input pin-input" value={pin} inputMode="numeric" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} maxLength={4} onChange={(e) => setPin(digits(e.target.value))} placeholder="••••" />
        </label>

        {mode === 'register' && (
          <>
            <label className="field">
              <span>הקוד שוב, לבדיקה</span>
              <input className="input pin-input" value={pin2} inputMode="numeric" type="password" autoComplete="new-password" maxLength={4} onChange={(e) => setPin2(digits(e.target.value))} placeholder="••••" />
            </label>
            <div className="field">
              <span>איך לפנות אליך?</span>
              <div className="seg">
                <button className={gender === 'm' ? 'on' : ''} onClick={() => setGender('m')}>בן</button>
                <button className={gender === 'f' ? 'on' : ''} onClick={() => setGender('f')}>בת</button>
              </div>
            </div>
            <div className="field">
              <span>באיזו כיתה?</span>
              <div className="seg">
                <button className={grade === 2 ? 'on' : ''} onClick={() => setGrade(2)}>כיתה ב'</button>
                <button className={grade === 3 ? 'on' : ''} onClick={() => setGrade(3)}>כיתה ג'</button>
              </div>
            </div>
            <div className="field">
              <span>צבע לדמות</span>
              <div className="swatches">
                {FREE_COLORS.map((c) => (
                  <button key={c.id} className={`swatch ${color === c.value ? 'on' : ''}`} style={{ background: c.value }} onClick={() => setColor(c.value)} aria-label={c.name} />
                ))}
              </div>
            </div>
          </>
        )}

        {err && <p className="login-error" role="alert">{err}</p>}
        <div className="row">
          <button className="btn btn-pink btn-lg" disabled={!ready || busy} onClick={() => void submit()}>{mode === 'login' ? 'כניסה' : 'הרשמה'}</button>
        </div>
        {mode === 'login' && <p className="muted small">שכחתם את הקוד? מבוגר שמנהל את המשחק יכול לאפס אותו.</p>}
      </div>
      <p className="privacy">
        🔒 בשרת נשמרים רק: השם, בית הספר, הכיתה וההתקדמות במשחק. הקוד נשמר מוצפן, ואף ילד לא יכול לראות נתונים של ילד אחר. הקלטות קוליות לא יוצאות מהמכשיר.
      </p>
    </div>
  );
}

/** Shown when this device used the data server before but cannot reach it now. */
export function Offline({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="screen profiles">
      <div className="card login-card">
        <h2>אין חיבור לשרת</h2>
        <p>ההתקדמות שמורה בשרת, ולכן צריך חיבור כדי להמשיך. בדקו את האינטרנט ונסו שוב.</p>
        <button className="btn btn-yellow btn-lg" onClick={onRetry}>לנסות שוב</button>
      </div>
    </div>
  );
}
