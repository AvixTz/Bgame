import { useEffect, useState } from 'react';
import { deletePlayer, isPersistent, listPlayers, newPlayer, savePlayer, type PlayerDoc } from '../data/db';
import { useApp } from '../core/store';
import { SHOP } from '../economy/economy';
import type { Grade } from '../brain/types';
import type { Gender } from '../core/rng';
import { sfx } from '../core/audio';

const FREE_COLORS = SHOP.filter((s) => s.kind === 'color' && s.price === 0);

export function Profiles() {
  const [players, setPlayers] = useState<PlayerDoc[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('m');
  const [grade, setGrade] = useState<Grade>(2);
  const [color, setColor] = useState(FREE_COLORS[0].value);
  const { setPlayer, go } = useApp();

  useEffect(() => { void listPlayers().then((p) => { setPlayers(p); if (!p.length) setCreating(true); }); }, []);

  const enter = (p: PlayerDoc) => { sfx.tap(); setPlayer(p); go('world'); };

  const create = async () => {
    const nick = name.trim();
    if (!nick) return;
    const p = newPlayer(nick.slice(0, 14), gender, grade, color);
    await savePlayer(p);
    enter(p);
  };

  return (
    <div className="screen profiles">
      <header className="brand">
        <h1>Bgame <span>אי המוח</span></h1>
        <p>עולם של חשבון וחשיבה לכיתות ב'-ג'</p>
      </header>

      {!creating && players && (
        <div className="card">
          <h2>מי משחק?</h2>
          <div className="profile-list">
            {players.map((p) => (
              <div key={p.id} className="profile-item">
                <button className="profile-btn" onClick={() => enter(p)}>
                  <span className="dot" style={{ background: p.color }} />
                  <b>{p.nickname}</b>
                  <small>כיתה {p.grade === 2 ? "ב'" : "ג'"} · 🪙 {p.coins}</small>
                </button>
                {confirmDel === p.id ? (
                  <div className="confirm-del">
                    <span>למחוק את {p.nickname}?</span>
                    <button className="btn btn-pink btn-sm" onClick={async () => { await deletePlayer(p.id); setConfirmDel(null); setPlayers(await listPlayers()); }}>מחיקה</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDel(null)}>ביטול</button>
                  </div>
                ) : (
                  <button className="icon-btn" aria-label={`מחיקת ${p.nickname}`} onClick={() => setConfirmDel(p.id)}>🗑️</button>
                )}
              </div>
            ))}
          </div>
          <button className="btn btn-yellow" onClick={() => setCreating(true)}>+ שחקן חדש</button>
        </div>
      )}

      {creating && (
        <div className="card">
          <h2>שחקן חדש</h2>
          <label className="field">
            <span>כינוי (לא שם מלא)</span>
            <input className="input" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="למשל: אלוף המספרים" autoFocus />
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
          <div className="row">
            <button className="btn btn-pink" disabled={!name.trim()} onClick={create}>יוצאים לדרך!</button>
            {players && players.length > 0 && <button className="btn btn-ghost" onClick={() => setCreating(false)}>חזרה</button>}
          </div>
        </div>
      )}

      <p className="privacy">
        {isPersistent()
          ? '🔒 הכול נשמר רק במכשיר הזה. לא נאסף שם מלא, אימייל או מיקום.'
          : '⚠️ הדפדפן חוסם שמירה. ההתקדמות תישמר רק עד סגירת הדף.'}
        {' '}גרסה ניסיונית.
      </p>
    </div>
  );
}
