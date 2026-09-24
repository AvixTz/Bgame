import { create } from 'zustand';
import { savePlayer, type PlayerDoc } from '../data/db';

export type Screen = 'loading' | 'profiles' | 'world' | 'mines' | 'library' | 'lab' | 'village' | 'arena' | 'story' | 'parent';
export type WorldId = 'mines' | 'library' | 'lab' | 'village' | 'arena' | 'story';

interface AppState {
  screen: Screen;
  player: PlayerDoc | null;
  nearPortal: WorldId | null;
  shopOpen: boolean;
  toast: string | null;
  /** Color of the portal wipe transition while it plays. */
  wipe: string | null;
  go: (s: Screen) => void;
  /** Go to a screen behind a circular portal wipe in the given color. */
  travel: (s: Screen, color: string) => void;
  setPlayer: (p: PlayerDoc | null) => void;
  updatePlayer: (fn: (p: PlayerDoc) => PlayerDoc) => void;
  setNearPortal: (w: WorldId | null) => void;
  setShopOpen: (v: boolean) => void;
  showToast: (t: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<AppState>((set, get) => ({
  screen: 'loading',
  player: null,
  nearPortal: null,
  shopOpen: false,
  toast: null,
  wipe: null,
  go: (screen) => set({ screen }),
  travel: (screen, color) => {
    if (get().wipe) return;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { set({ screen }); return; }
    set({ wipe: color });
    setTimeout(() => set({ screen }), 330);
    setTimeout(() => set({ wipe: null }), 780);
  },
  setPlayer: (player) => set({ player }),
  updatePlayer: (fn) => {
    const p = get().player;
    if (!p) return;
    const next = fn(p);
    set({ player: next });
    void savePlayer(next);
  },
  setNearPortal: (nearPortal) => {
    if (get().nearPortal !== nearPortal) set({ nearPortal });
  },
  setShopOpen: (shopOpen) => set({ shopOpen }),
  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: null }), 2600);
  },
}));
