import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ShoppingBag, Star, Users, Volume2, VolumeX } from 'lucide-react';
import { isServerMode, logout } from '../data/remote';
import { useApp } from '../core/store';
import { PORTALS } from '../world/portals';
import { weeklyProgress } from '../economy/economy';
import { g } from '../core/rng';
import { isMuted, setMuted, sfx } from '../core/audio';

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export function WeekDots({ playedDays }: { playedDays: string[] }) {
  const w = weeklyProgress(playedDays, Date.now());
  return (
    <div className="week" title={`יעד שבועי: ${w.done} מתוך ${w.target} ימים`} aria-label={`יעד שבועי: ${w.done} מתוך ${w.target} ימים`}>
      {w.days.map((d, i) => (
        <span key={d.key} className={`wd ${d.played ? 'played' : ''} ${d.today ? 'today' : ''}`}>
          {d.played ? <Star className="icon" /> : DAY_LETTERS[i]}
        </span>
      ))}
      <b>{Math.min(w.done, w.target)}/{w.target}</b>
    </div>
  );
}

/** Coin counter that bumps whenever the value grows. */
export function CoinPill({ value }: { value: number }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (value > prev.current) { setBump(true); const t = setTimeout(() => setBump(false), 450); prev.current = value; return () => clearTimeout(t); }
    prev.current = value;
  }, [value]);
  return (
    <span className={`coins coin-pill ${bump ? 'bump' : ''}`} aria-label={`${value} מטבעות`}>
      <span className="coin-ico" aria-hidden /> {value}
    </span>
  );
}

export function Hud({ onEnter }: { onEnter: () => void }) {
  const { player, nearPortal, setShopOpen, go, setPlayer } = useApp();
  const [muted, setM] = useState(isMuted());
  if (!player) return null;
  const portal = PORTALS.find((p) => p.id === nearPortal);
  const firstVisit = player.journeysCompleted === 0 && !player.placementDone;
  const Icon = portal?.icon;

  return (
    <>
      <div className="hud-top">
        <div className="chip-player">
          <span className="dot" style={{ background: player.color }} />
          <b>{player.nickname}</b>
          <CoinPill value={player.coins} />
        </div>
        <WeekDots playedDays={player.playedDays} />
        <div className="hud-actions">
          <button className="icon-btn" onClick={() => { sfx.tap(); setShopOpen(true); }} aria-label="חנות הדמות" title="חנות הדמות"><ShoppingBag className="icon" /></button>
          <button className="icon-btn" onClick={() => go('parent')} aria-label="אזור הורים" title="אזור הורים"><Users className="icon" /></button>
          <button className="icon-btn" onClick={() => { setMuted(!muted); setM(!muted); }} aria-label={muted ? 'הפעלת צליל' : 'השתקה'} title="צליל">{muted ? <VolumeX className="icon" /> : <Volume2 className="icon" />}</button>
          <button className="icon-btn" onClick={async () => { if (isServerMode()) { await logout(); setPlayer(null); go('login'); } else { setPlayer(null); go('profiles'); } }} aria-label="החלפת שחקן" title="החלפת שחקן"><RefreshCw className="icon" /></button>
        </div>
      </div>

      {firstVisit && !portal && (
        <div className="coach">
          {g('הזז{|י} את הדמות עם החצים או עם הג\'ויסטיק, ובח{ר|רי} עולם. מכרות המספרים מחכים לך!', player.gender)}
        </div>
      )}

      {portal && Icon && (
        <div className="portal-prompt">
          <button className="btn btn-lg" style={{ ['--b' as string]: portal.color, ['--b-d' as string]: portal.dark, ['--b-t' as string]: '#fff' }} onClick={onEnter}>
            <Icon className="icon" /> כניסה ל{portal.name}
          </button>
        </div>
      )}
    </>
  );
}
