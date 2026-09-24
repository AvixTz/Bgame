import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useApp } from './core/store';
import { initDb, listPlayers } from './data/db';
import { Profiles } from './ui/Profiles';
import { Hud } from './ui/Hud';
import { Joystick } from './ui/Joystick';
import { Shop } from './ui/Shop';
import { Parent } from './ui/Parent';
import { SubjectWorld, WORLDS } from './minigames/subject/SubjectWorld';
import { Arena } from './minigames/arena/Arena';
import { Village } from './minigames/village/Village';
import { PORTALS } from './world/portals';
import { bindKeyboard, resetInput } from './world/controls';
import { sfx } from './core/audio';

const WorldCanvas = lazy(() => import('./world/World').then((m) => ({ default: m.WorldCanvas })));

/**
 * The 3D world stays mounted once it has been opened and is only hidden and paused while the child is
 * in a mini-game. Returning is instant, the avatar is where it was, and the WebGL context is not rebuilt.
 */
function WorldScreen({ active }: { active: boolean }) {
  const { player, go, shopOpen } = useApp();
  const last = useRef(player);
  if (player) last.current = player;
  const enter = () => {
    const st = useApp.getState();
    const portal = PORTALS.find((x) => x.id === st.nearPortal);
    if (st.screen === 'world' && portal?.open) { sfx.tap(); go(portal.id); }
  };
  useEffect(() => (active ? bindKeyboard(enter) : resetInput()), [active]);
  const p = last.current;
  if (!p) return null;
  const mastered = Object.values(p.skills).filter((s) => s.mastered).length;
  return (
    <div className="world" style={active ? undefined : { visibility: 'hidden', pointerEvents: 'none' }} aria-hidden={!active}>
      <Suspense fallback={<div className="loading">🏝️ טוען את האי…</div>}>
        <WorldCanvas color={p.color} hat={p.hat} mastered={mastered} collectibles={p.collectibles} active={active} />
      </Suspense>
      {active && <Hud onEnter={enter} />}
      {active && <Joystick />}
      {active && shopOpen && <Shop />}
    </div>
  );
}

export function App() {
  const { screen, go, toast, player } = useApp();
  const [worldOpened, setWorldOpened] = useState(false);
  useEffect(() => { if (screen === 'world') setWorldOpened(true); }, [screen]);
  useEffect(() => {
    void initDb().then(() => listPlayers()).then(() => go('profiles'));
  }, [go]);

  return (
    <>
      {screen === 'loading' && <div className="loading">טוען…</div>}
      {screen === 'profiles' && <Profiles />}
      {worldOpened && <WorldScreen active={screen === 'world' && !!player} />}
      {(screen === 'mines' || screen === 'library' || screen === 'lab') && (
        <SubjectWorld key={screen} config={WORLDS[screen]} onExit={() => go('world')} />
      )}
      {screen === 'arena' && <Arena onExit={() => go('world')} />}
      {screen === 'village' && <Village onExit={() => go('world')} />}
      {screen === 'parent' && <Parent />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
