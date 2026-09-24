import { create } from 'zustand';
import { savePlayer, type PlayerDoc } from '../data/db';

export type Screen = 'loading' | 'profiles' | 'world' | 'mines' | 'parent';
export type WorldId = 'mines' | 'library' | 'lab' | 'village' | 'arena';

interface AppState {
  screen: Screen;
  player: PlayerDoc | null;
  nearPortal: WorldId | null;
  shopOpen: boolean;
  toast: string | null;
  go: (s: Screen) => void;
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
  go: (screen) => set({ screen }),
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
