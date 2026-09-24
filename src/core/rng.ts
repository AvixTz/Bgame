export type Rng = () => number;

/** mulberry32 - small seeded PRNG so items are reproducible in tests. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type Gender = 'm' | 'f';
const TO_FINAL: Record<string, string> = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };
const FROM_FINAL: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/**
 * Hebrew gendered text: "בד{וק|קי} שוב" -> masculine / feminine form.
 * After substitution, letters are normalised to their final/regular forms, so "מזמינ{|ה}" gives
 * "מזמין" / "מזמינה" and "מרים{|ה}" gives "מרים" / "מרימה".
 */
export const g = (text: string, gender: Gender) =>
  text
    .replace(/\{([^|}]*)\|([^}]*)\}/g, (_, m, f) => (gender === 'f' ? f : m))
    .replace(/[כמנפצ](?![\u05D0-\u05EA\-־'"״׳])/g, (c) => TO_FINAL[c])
    .replace(/[ךםןףץ](?=[\u05D0-\u05EA])/g, (c) => FROM_FINAL[c]);
