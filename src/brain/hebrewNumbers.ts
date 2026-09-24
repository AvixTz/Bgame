/**
 * Hebrew number words.
 * `countF` - the counting form used in school math (feminine: "שלוש, ארבע עשרה, עשרים ושבע").
 * `withNoun` - a number agreeing with a counted noun ("שלושה תפוזים", "שתי בובות"), 2..19.
 * The conjunction ו attaches to the last component ("מאה עשרים ושלוש", "מאה וחמש").
 */
const ONES_F = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const TEENS_F = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];

export function countF(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 1000) throw new Error(`countF: ${n} out of range`);
  if (n === 0) return 'אפס';
  if (n === 1000) return 'אלף';
  const parts: string[] = [];
  const h = Math.floor(n / 100), rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(TEENS_F[rest - 10]);
  else {
    const t = Math.floor(rest / 10), u = rest % 10;
    if (t) parts.push(TENS[t]);
    if (u) parts.push(ONES_F[u]);
  }
  if (parts.length > 1) parts[parts.length - 1] = 'ו' + parts[parts.length - 1];
  return parts.join(' ');
}

const M_BEFORE_NOUN = ['', '', 'שני', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה'];
const F_BEFORE_NOUN = ['', '', 'שתי', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'];
const M_TEENS = ['', 'אחד עשר', 'שנים עשר', 'שלושה עשר', 'ארבעה עשר', 'חמישה עשר', 'שישה עשר', 'שבעה עשר', 'שמונה עשר', 'תשעה עשר'];
const F_TEENS = ['', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];

/** "שלושה תפוזים" / "שתי בובות". Supports 2..19 (numbers a grade ב-ג story uses in words). */
export function withNoun(n: number, noun: string, gender: 'm' | 'f'): string {
  if (!Number.isInteger(n) || n < 2 || n > 19) throw new Error(`withNoun: ${n} out of range`);
  const num = n <= 10 ? (gender === 'm' ? M_BEFORE_NOUN : F_BEFORE_NOUN)[n] : (gender === 'm' ? M_TEENS : F_TEENS)[n - 10];
  return `${num} ${noun}`;
}
