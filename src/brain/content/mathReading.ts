import type { CurriculumNode } from '../types';
import type { Draft } from '../generators';
import { pick, randInt, type Rng } from '../../core/rng';
import { choiceDraft, hints3 } from './helpers';
import { countF, withNoun } from '../hebrewNumbers';

/**
 * Math + reading together ("חשבון וקריאה"): the child has to read to calculate.
 * Numbers in words (the grade ב requirement to read and write numbers), exercises written in words,
 * and short math stories where the numbers and the operation must be found in the text.
 */
export const MATH_READING_NODES: CurriculumNode[] = [
  { id: 'mr_numwords', subject: 'math', grade: 2, strand: 'math_reading', title: 'חשבון וקריאה: מספרים במילים', short: 'מספרים במילים', prerequisites: [], tierDifficulty: [-1.3, -0.5, 0.3], curriculumVersion: 'new-2023' },
  { id: 'mr_wordcalc', subject: 'math', grade: 2, strand: 'math_reading', title: 'חשבון וקריאה: תרגילים במילים', short: 'תרגילים במילים', prerequisites: ['mr_numwords', 'b_add'], tierDifficulty: [-1.0, -0.2, 0.6], curriculumVersion: 'new-2023' },
  { id: 'mr_story', subject: 'math', grade: 3, strand: 'math_reading', title: 'חשבון וקריאה: סיפורי חשבון', short: 'סיפורי חשבון', prerequisites: ['mr_wordcalc', 'g_mult_easy'], tierDifficulty: [-0.2, 0.5, 1.2], curriculumVersion: '2006' },
];

// ---------------- numbers in words ----------------

function numWords(rng: Rng, tier: 1 | 2 | 3): Draft {
  const n = tier === 1 ? randInt(rng, 11, 20) : tier === 2 ? randInt(rng, 21, 99) : randInt(rng, 101, 999);
  const words = countF(n);
  if (rng() < 0.5) {
    return {
      key: `w2d-${n}`,
      prompt: `איזה מספר כתוב כאן?\n${words}`,
      speech: `איזה מספר כתוב כאן? ${words}`,
      answer: n,
      strategies: ['decompose', 'look_back'],
      hints: hints3(
        'אסטרטגיה: לפרק לחלקים 🧩. קוראים את המספר חלק אחרי חלק: מאות, עשרות, יחידות.',
        n > 100 ? `"${countF(Math.floor(n / 100) * 100)}" זה ${Math.floor(n / 100) * 100}. ואחר כך?` : n >= 20 ? `"${countF(Math.floor(n / 10) * 10)}" זה ${Math.floor(n / 10) * 10}. כמה יחידות נוספות?` : 'מספרים עם "עשרה" הם בין 11 ל-19.',
        `${words} = ${n}`,
      ),
      explain: `${words} = ${n}`,
    };
  }
  const t = Math.floor(n / 10) % 10, u = n % 10;
  const wrong = new Set<string>();
  if (n < 20) { wrong.add(countF(u * 10 || 70)); wrong.add(countF(u || 1)); wrong.add(countF(n + 1 > 20 ? n - 1 : n + 1)); }
  else {
    const swapped = (n - (t * 10 + u)) + u * 10 + t;
    if (u !== 0 && swapped !== n && swapped <= 1000) wrong.add(countF(swapped));
    wrong.add(countF(n - u + ((u + 2) % 10)));
    wrong.add(countF(n >= 100 ? n - 100 : n + 10 <= 99 ? n + 10 : n - 10));
  }
  wrong.delete(words);
  return choiceDraft(rng, {
    key: `d2w-${n}`,
    prompt: `איך כותבים את המספר ${n} במילים?`,
    correct: words,
    wrong: [...wrong],
    strategies: ['decompose', 'eliminate'],
    hints: hints3(
      'אסטרטגיה: לפסול תשובות ❌. קראו כל תשובה ובדקו: כמה עשרות? כמה יחידות?',
      n >= 20 ? `ב-${n} יש ${t} עשרות ו-${u} יחידות.` : `${n} זה עשר ועוד ${n - 10}.`,
      `${n} = ${words}`,
    ),
    explain: `${n} = ${words}`,
  });
}

// ---------------- exercises in words ----------------

function wordCalc(rng: Rng, tier: 1 | 2 | 3): Draft {
  let a: number, b: number;
  const op: '+' | '−' = rng() < 0.55 ? '+' : '−';
  if (tier === 1) {
    a = randInt(rng, 5, 12); b = randInt(rng, 2, 8);
    if (op === '−' && b > a) [a, b] = [b, a];
  } else if (tier === 2) {
    // two-digit, no regrouping
    if (op === '+') { const at = randInt(rng, 1, 7), bt = randInt(rng, 1, 8 - at), au = randInt(rng, 0, 8), bu = randInt(rng, 1, 9 - au); a = at * 10 + au; b = bt * 10 + bu; }
    else { const at = randInt(rng, 3, 9), bt = randInt(rng, 1, at - 1), au = randInt(rng, 1, 9), bu = randInt(rng, 0, au); a = at * 10 + au; b = bt * 10 + bu; }
  } else {
    // two-digit with regrouping
    if (op === '+') { const au = randInt(rng, 2, 9), bu = randInt(rng, 10 - au, 9), at = randInt(rng, 1, 6), bt = randInt(rng, 1, 8 - at); a = at * 10 + au; b = bt * 10 + bu; }
    else { const au = randInt(rng, 0, 8), bu = randInt(rng, au + 1, 9), at = randInt(rng, 3, 9), bt = randInt(rng, 1, at - 1); a = at * 10 + au; b = bt * 10 + bu; }
  }
  const ans = op === '+' ? a + b : a - b;
  const phrase = `${countF(a)} ${op === '+' ? 'ועוד' : 'פחות'} ${countF(b)}`;
  return {
    key: `${a}${op}${b}`,
    prompt: `קראו את התרגיל ופתרו:\n${phrase}`,
    speech: `${phrase}. כמה זה?`,
    answer: ans,
    strategies: ['look_back', 'decompose'],
    hints: hints3(
      'אסטרטגיה: לחזור לטקסט 📖. קודם כותבים את התרגיל במספרים, ואז פותרים.',
      `${countF(a)} = ${a}, ${countF(b)} = ${b}. התרגיל הוא ${a} ${op} ${b}.`,
      `${a} ${op} ${b} = ${ans} (${countF(ans)})`,
    ),
    explain: `${phrase} = ${a} ${op} ${b} = ${ans}`,
  };
}

// ---------------- math stories ----------------

type G = 'm' | 'f';
const NAMES: [string, G][] = [
  ['נועה', 'f'], ['איתי', 'm'], ['מאיה', 'f'], ['עומר', 'm'], ['תמר', 'f'], ['יונתן', 'm'], ['שירה', 'f'], ['אדם', 'm'],
  ['ליה', 'f'], ['נדב', 'm'], ['יאסמין', 'f'], ['מוחמד', 'm'], ['אלמז', 'f'], ['סשה', 'm'], ['הילה', 'f'], ['דניאל', 'm'],
];
interface Story { text: string; q: string; answer: number; expr: string; steps: string }

function stories(rng: Rng, tier: 1 | 2 | 3): Story {
  const [name, gg] = pick(rng, NAMES);
  const v = (m: string, f: string) => (gg === 'f' ? f : m);
  const he = v('הוא', 'היא');
  if (tier === 1) {
    const kind = randInt(rng, 0, 3);
    const a = randInt(rng, 6, 15), b = randInt(rng, 2, Math.min(9, a - 1));
    if (kind === 0) return { text: `${name} ${v('אסף', 'אספה')} ${withNoun(a, 'צדפים', 'm')} בחוף הים. אחר כך ${he} ${v('מצא', 'מצאה')} עוד ${withNoun(b, 'צדפים', 'm')}.`, q: `כמה צדפים ${v('אסף', 'אספה')} ${name} בסך הכול?`, answer: a + b, expr: `${a} + ${b}`, steps: 'אסף ועוד מצא, כלומר חיבור' };
    if (kind === 1) return { text: `ל${name} היו ${withNoun(a, 'מדבקות', 'f')}. ${he} ${v('נתן', 'נתנה')} לחבר ${withNoun(b, 'מדבקות', 'f')}.`, q: `כמה מדבקות נשארו ל${name}?`, answer: a - b, expr: `${a} − ${b}`, steps: 'נתן לחבר, כלומר פחות: חיסור' };
    if (kind === 2) return { text: `על העץ ישבו ${withNoun(a, 'ציפורים', 'f')}. ${withNoun(b, 'ציפורים', 'f')} עפו משם.`, q: 'כמה ציפורים נשארו על העץ?', answer: a - b, expr: `${a} − ${b}`, steps: 'ציפורים עפו, כלומר חיסור' };
    return { text: `באוטובוס נסעו ${withNoun(a, 'ילדים', 'm')}. בתחנה עלו עוד ${withNoun(b, 'ילדים', 'm')}.`, q: 'כמה ילדים נוסעים עכשיו באוטובוס?', answer: a + b, expr: `${a} + ${b}`, steps: 'עלו עוד ילדים, כלומר חיבור' };
  }
  if (tier === 2) {
    const kind = randInt(rng, 0, 3);
    const a = randInt(rng, 2, 9), b = randInt(rng, 2, 9);
    if (kind === 0) return { text: `בכיתה יש ${withNoun(a, 'שולחנות', 'm')}. ליד כל שולחן יושבים ${withNoun(b, 'ילדים', 'm')}.`, q: 'כמה ילדים יושבים בכיתה?', answer: a * b, expr: `${a} × ${b}`, steps: 'אותו מספר ילדים ליד כל שולחן, כלומר כפל' };
    if (kind === 1) return { text: `בגינה יש ${withNoun(a, 'שורות', 'f')} של פרחים. בכל שורה יש ${withNoun(b, 'פרחים', 'm')}.`, q: 'כמה פרחים יש בגינה?', answer: a * b, expr: `${a} × ${b}`, steps: 'שורות שוות, כלומר כפל' };
    if (kind === 2) return { text: `${name} ${v('אפה', 'אפתה')} ${a * b} עוגיות, ו${v('חילק', 'חילקה')} אותן שווה בשווה ל${withNoun(a, 'צלחות', 'f')}.`, q: 'כמה עוגיות יש בכל צלחת?', answer: b, expr: `${a * b} : ${a}`, steps: 'חלוקה שווה, כלומר חילוק' };
    return { text: `כדור עולה ${withNoun(b, 'שקלים', 'm')}. ${name} ${v('רוצה', 'רוצה')} לקנות ${withNoun(a, 'כדורים', 'm')}.`, q: `כמה שקלים ${name} ${v('צריך', 'צריכה')} לשלם?`, answer: a * b, expr: `${a} × ${b}`, steps: 'כמה כדורים כפול המחיר של כדור אחד' };
  }
  const kind = randInt(rng, 0, 3);
  const a = randInt(rng, 3, 8), b = randInt(rng, 3, 9);
  if (kind === 0) {
    const c = randInt(rng, 2, a * b - 2);
    return { text: `${name} ${v('קנה', 'קנתה')} ${withNoun(a, 'חבילות', 'f')} של מדבקות. בכל חבילה יש ${withNoun(b, 'מדבקות', 'f')}. ${he} ${v('נתן', 'נתנה')} ${c} מדבקות לאחות ${v('שלו', 'שלה')}.`, q: `כמה מדבקות נשארו ל${name}?`, answer: a * b - c, expr: `${a} × ${b} − ${c}`, steps: `צעד 1: כמה מדבקות היו (${a} × ${b} = ${a * b}). צעד 2: מורידים את מה ש${name} ${v('נתן', 'נתנה')} (${a * b} − ${c}).` };
  }
  if (kind === 1) {
    const c = randInt(rng, 3, a * b - 3);
    return { text: `באולם יש ${withNoun(a, 'שורות', 'f')} של כיסאות, ובכל שורה ${withNoun(b, 'כיסאות', 'm')}. ${c} כיסאות כבר תפוסים.`, q: 'כמה כיסאות פנויים?', answer: a * b - c, expr: `${a} × ${b} − ${c}`, steps: `צעד 1: כמה כיסאות יש בכלל (${a} × ${b} = ${a * b}). צעד 2: מורידים את התפוסים.` };
  }
  if (kind === 2) {
    const r = randInt(rng, 5, 30);
    const total = a * b + r;
    return { text: `${name} ${v('קורא', 'קוראת')} ${withNoun(a, 'עמודים', 'm')} בכל יום. ${he} ${v('קרא', 'קראה')} כבר ${withNoun(b, 'ימים', 'm')}. בספר יש ${total} עמודים.`, q: `כמה עמודים נשארו ל${name} לקרוא?`, answer: r, expr: `${total} − ${a} × ${b}`, steps: `צעד 1: כמה עמודים ${name} כבר ${v('קרא', 'קראה')} (${a} × ${b} = ${a * b}). צעד 2: ${total} − ${a * b}.` };
  }
  const price = randInt(rng, 2, 6);
  const money = a * price + randInt(rng, 3, 25);
  return { text: `${name} ${v('קיבל', 'קיבלה')} ${money} שקלים. ${he} ${v('קנה', 'קנתה')} ${withNoun(a, 'עפרונות', 'm')}, וכל עיפרון עולה ${withNoun(price, 'שקלים', 'm')}.`, q: `כמה שקלים נשארו ל${name}?`, answer: money - a * price, expr: `${money} − ${a} × ${price}`, steps: `צעד 1: כמה עלו העפרונות (${a} × ${price} = ${a * price}). צעד 2: ${money} − ${a * price}.` };
}

function story(rng: Rng, tier: 1 | 2 | 3): Draft {
  const s = stories(rng, tier);
  return {
    key: `${tier}-${s.text.length}-${s.answer}-${s.expr}`,
    passage: s.text,
    prompt: s.q,
    speech: `${s.text} ${s.q}`,
    answer: s.answer,
    strategies: tier === 3 ? ['look_back', 'decompose'] : ['look_back', 'draw'],
    hints: hints3(
      tier === 3 ? 'אסטרטגיה: לפרק לחלקים 🧩. זה סיפור בשני צעדים. קראו שוב ומצאו את שני החלקים.' : 'אסטרטגיה: לחזור לטקסט 📖. סמנו בראש את המספרים ואת המילה שאומרת מה קרה.',
      s.steps,
      `${s.expr} = ${s.answer}`,
    ),
    explain: `${s.expr} = ${s.answer}`,
  };
}

export const MATH_READING_GENERATORS: Record<string, (rng: Rng, tier: 1 | 2 | 3) => Draft> = {
  mr_numwords: numWords,
  mr_wordcalc: wordCalc,
  mr_story: story,
};

