import { useApp } from '../core/store';
import { PORTALS } from '../world/portals';
import { weeklyProgress } from '../economy/economy';
import { g } from '../core/rng';
import { isMuted, setMuted, sfx } from '../core/audio';
import { useState } from 'react';

const DAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

export function WeekDots({ playedDays }: { playedDays: string[] }) {
  const w = weeklyProgress(playedDays, Date.now());
  return (
    <div className="week" title={`יעד שבועי: ${w.done} מתוך ${w.target} ימים`}>
      {w.days.map((d, i) => (
        <span key={d.key} className={`wd ${d.played ? 'played' : ''} ${d.today ? 'today' : ''}`}>{d.played ? '⭐' : DAY_LETTERS[i]}</span>
      ))}
      <b>{Math.min(w.done, w.target)}/{w.target}</b>
    </div>
  );
}

export function Hud({ onEnter }: { onEnter: () => void }) {
  const { player, nearPortal, setShopOpen, go, setPlayer } = useApp();
  const [muted, setM] = useState(isMuted());
  if (!player) return null;
  const portal = PORTALS.find((p) => p.id === nearPortal);
  const firstVisit = player.journeysCompleted === 0 && !player.placementDone;

  return (
    <>
      <div className="hud-top">
        <div className="chip-player">
          <span className="dot" style={{ background: player.color }} />
          <b>{player.nickname}</b>
          <span className="coins">🪙 {player.coins}</span>
        </div>
        <WeekDots playedDays={player.playedDays} />
        <div className="hud-actions">
          <button className="icon-btn" onClick={() => { sfx.tap(); setShopOpen(true); }} aria-label="חנות הדמות">🛍️</button>
          <button className="icon-btn" onClick={() => go('parent')} aria-label="אזור הורים">👨‍👩‍👧</button>
          <button className="icon-btn" onClick={() => { setMuted(!muted); setM(!muted); }} aria-label="צליל">{muted ? '🔇' : '🔊'}</button>
          <button className="icon-btn" onClick={() => { setPlayer(null); go('profiles'); }} aria-label="החלפת שחקן">🔄</button>
        </div>
      </div>

      {firstVisit && !portal && (
        <div className="coach">
          {g('הזז{|י} את הדמות עם החצים או עם הג\'ויסטיק, ול{ך|כי} אל ⛏️ מכרות המספרים', player.gender)}
        </div>
      )}

      {portal && (
        <div className="portal-prompt">
          {portal.open ? (
            <button className="btn btn-yellow btn-lg" onClick={onEnter}>{portal.emoji} כניסה ל{portal.name}</button>
          ) : (
            <div className="card small">{portal.emoji} {portal.name} ייפתח בקרוב!</div>
          )}
        </div>
      )}
    </>
  );
}
