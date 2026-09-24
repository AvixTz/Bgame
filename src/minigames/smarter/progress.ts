/**
 * Word status for "חכמים יותר". Days are calendar days (local day keys, YYYY-MM-DD).
 *
 *   טרם נלמד  - never opened.
 *   הוצג      - the child met the word. Stays like this for the first two days.
 *   בתרגול    - at least two days since the word was shown, and the questions were passed on at least
 *               two different days.
 *   מכירים    - at least three days since the word was shown, the word was in practice, and the child
 *               marked that they used it in real life (with an optional note or voice recording).
 */
export type WordStatus = 'new' | 'shown' | 'practice' | 'known';

export interface WordProgress {
  shownDay: string;
  /** Days on which the child passed the questions. */
  passDays: string[];
  usedDay?: string;
  note?: string;
  recordingId?: number;
}

export const STATUS_LABEL: Record<WordStatus, string> = { new: 'טרם נלמד', shown: 'הוצג', practice: 'בתרגול', known: 'מכירים' };
export const STATUS_ORDER: WordStatus[] = ['new', 'shown', 'practice', 'known'];

const toUtc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));
export const dayDiff = (later: string, earlier: string) => Math.round((toUtc(later) - toUtc(earlier)) / 86_400_000);

export function wordStatus(p: WordProgress | undefined, today: string): WordStatus {
  if (!p) return 'new';
  if (p.usedDay) return 'known';
  if (dayDiff(today, p.shownDay) >= 2 && new Set(p.passDays).size >= 2) return 'practice';
  return 'shown';
}

export const canMarkUsed = (p: WordProgress | undefined, today: string) =>
  !!p && wordStatus(p, today) === 'practice' && dayDiff(today, p.shownDay) >= 3;

/** A quiz is passed when at most one question needed a second try. */
export const quizPassed = (firstTryCorrect: number, total: number) => total > 0 && firstTryCorrect >= total - 1;

/** Should this word be offered in today's practice list? */
export const dueToday = (p: WordProgress | undefined, today: string) =>
  !!p && !p.usedDay && (!p.passDays.includes(today) && new Set(p.passDays).size < 2 || canMarkUsed(p, today));

/** What the child should do next with this word, in the child's language (gender markers allowed). */
export function nextStep(p: WordProgress | undefined, today: string): string {
  const s = wordStatus(p, today);
  if (s === 'new') return 'להכיר את המילה ולענות על השאלות';
  if (s === 'known') return 'המילה כבר שלך!';
  const passed = new Set(p!.passDays).size;
  const passedToday = p!.passDays.includes(today);
  if (s === 'shown') {
    if (passed >= 2) return 'עוד קצת: המילה עוברת לתרגול יומיים אחרי שהכרת אותה';
    return passedToday ? 'מחר עונים שוב על השאלות' : 'לענות על השאלות היום';
  }
  return canMarkUsed(p, today) ? 'השתמש{|ת} במילה בחיים? אפשר לסמן!' : 'מחר אפשר לסמן שהשתמשת במילה בחיים';
}
