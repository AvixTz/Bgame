import type { Rng } from '../core/rng';

/**
 * Coins pay for competence, never for time or logins (Deci, Koestner & Ryan 1999).
 * Positive informational feedback matters more than the coins themselves.
 */
export const COINS = {
  firstTry: 3,
  afterRetryOrHint: 1,
  journeyComplete: 10,
  mastery: 25,
  reviewKept: 5,
} as const;

export const JOURNEY_LENGTH = 8;
export const WEEKLY_TARGET = 5;

export interface ShopItem {
  id: string;
  kind: 'color' | 'hat';
  name: string;
  price: number;
  value: string;
}

export const SHOP: ShopItem[] = [
  { id: 'c_pink', kind: 'color', name: 'ורוד', price: 0, value: '#FF3D7F' },
  { id: 'c_blue', kind: 'color', name: 'כחול', price: 0, value: '#3D5AFE' },
  { id: 'c_mint', kind: 'color', name: 'מנטה', price: 0, value: '#00C896' },
  { id: 'c_yellow', kind: 'color', name: 'צהוב', price: 20, value: '#FFC02E' },
  { id: 'c_purple', kind: 'color', name: 'סגול', price: 30, value: '#8B5CF6' },
  { id: 'c_orange', kind: 'color', name: 'כתום', price: 30, value: '#FF8A00' },
  { id: 'h_none', kind: 'hat', name: 'בלי כובע', price: 0, value: 'none' },
  { id: 'h_cap', kind: 'hat', name: 'כובע מצחייה', price: 40, value: 'cap' },
  { id: 'h_crown', kind: 'hat', name: 'כתר', price: 120, value: 'crown' },
  { id: 'h_miner', kind: 'hat', name: 'קסדת כורה', price: 60, value: 'miner' },
  { id: 'h_wizard', kind: 'hat', name: 'כובע קוסם', price: 90, value: 'wizard' },
];

export interface Collectible { id: string; emoji: string; name: string }

/** Surprise finds after a finished journey. Random and never sold for money: no loot boxes. */
export const COLLECTIBLES: Collectible[] = [
  { id: 'gem_red', emoji: '💎', name: 'יהלום נוצץ' },
  { id: 'crystal', emoji: '🔮', name: 'כדור בדולח' },
  { id: 'fossil', emoji: '🦴', name: 'מאובן עתיק' },
  { id: 'gold', emoji: '🪙', name: 'מטבע זהב עתיק' },
  { id: 'mushroom', emoji: '🍄', name: 'פטריית מערה' },
  { id: 'bat', emoji: '🦇', name: 'עטלף חמוד' },
  { id: 'lantern', emoji: '🏮', name: 'פנס כורים' },
  { id: 'map', emoji: '🗺️', name: 'מפת אוצר' },
  { id: 'owl', emoji: '🦉', name: 'ינשוף חכם' },
  { id: 'star', emoji: '🌟', name: 'כוכב נופל' },
];

export function rollSurprise(rng: Rng, owned: string[]): Collectible | null {
  if (rng() > 0.35) return null;
  const left = COLLECTIBLES.filter((c) => !owned.includes(c.id));
  if (!left.length) return null;
  return left[Math.floor(rng() * left.length)];
}

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Israeli week: Sunday to Saturday. Returns the 7 day keys of the week containing `t`. */
export function weekDays(t: number): string[] {
  const d = new Date(t);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return dayKey(x.getTime());
  });
}

/**
 * Weekly goal instead of a fragile daily streak: 5 of 7 days, the other 2 are built-in rest days.
 * Progress never "breaks" (Sharif & Shu 2021; UK Children's Code std. 13).
 */
export function weeklyProgress(playedDays: string[], now: number) {
  const days = weekDays(now);
  const set = new Set(playedDays);
  const done = days.filter((d) => set.has(d)).length;
  return {
    days: days.map((d) => ({ key: d, played: set.has(d), today: d === dayKey(now) })),
    done,
    target: WEEKLY_TARGET,
    reached: done >= WEEKLY_TARGET,
  };
}
