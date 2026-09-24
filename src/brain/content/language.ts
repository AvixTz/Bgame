import type { CurriculumNode } from '../types';
import type { Draft } from '../generators';
import { pick, shuffle, type Rng } from '../../core/rng';
import { choiceDraft, hints3 } from './helpers';

/**
 * Hebrew language (לשון) for grades ב-ג.
 * Source: חינוך לשוני 1-6 and its required achievements at the end of ב / ד. The ministry defines
 * checkpoints, not single grades, so the grade assignment here is ours and needs a teacher's review.
 */
export const LANGUAGE_NODES: CurriculumNode[] = [
  { id: 'l_gender', subject: 'language', grade: 2, strand: 'grammar', title: 'זכר ונקבה', short: 'זכר ונקבה', prerequisites: [], tierDifficulty: [-1.2, -0.5, 0.4], curriculumVersion: 'hebrew-1-6' },
  { id: 'l_number', subject: 'language', grade: 2, strand: 'grammar', title: 'יחיד ורבים', short: 'יחיד ורבים', prerequisites: [], tierDifficulty: [-1.1, -0.4, 0.5], curriculumVersion: 'hebrew-1-6' },
  { id: 'l_punct', subject: 'language', grade: 2, strand: 'writing', title: 'סימני פיסוק: . ? !', short: 'סימני פיסוק', prerequisites: [], tierDifficulty: [-1.0, -0.4, 0.3], curriculumVersion: 'hebrew-1-6' },
  { id: 'l_opposites', subject: 'language', grade: 2, strand: 'vocab', title: 'מילים הפוכות', short: 'הפכים', prerequisites: [], tierDifficulty: [-1.3, -0.6, 0.2], curriculumVersion: 'hebrew-1-6' },
  { id: 'l_family', subject: 'language', grade: 2, strand: 'morphology', title: 'משפחת מילים', short: 'משפחת מילים', prerequisites: [], tierDifficulty: [-0.6, 0.1, 0.8], curriculumVersion: 'hebrew-1-6' },
  { id: 'l_synonyms', subject: 'language', grade: 3, strand: 'vocab', title: 'מילים נרדפות', short: 'מילים נרדפות', prerequisites: ['l_opposites'], tierDifficulty: [-0.5, 0.1, 0.7], curriculumVersion: 'hebrew-1-6' },
  { id: 'l_root', subject: 'language', grade: 3, strand: 'morphology', title: 'השורש', short: 'שורש', prerequisites: ['l_family'], tierDifficulty: [0.0, 0.6, 1.2], curriculumVersion: 'hebrew-1-6' },
  { id: 'l_read', subject: 'language', grade: 3, strand: 'reading', title: 'הבנת הנקרא', short: 'הבנת הנקרא', prerequisites: [], tierDifficulty: [-0.4, 0.3, 1.0], curriculumVersion: 'hebrew-1-6' },
];

// ---------- זכר ונקבה: adjective agreement ----------

type G = 'm' | 'f';
type N = 's' | 'p';
interface Noun { w: string; g: G; n: N; animate?: boolean; tricky?: string; one?: string }
const NOUNS: [Noun[], Noun[], Noun[]] = [
  [
    { w: 'ילד', g: 'm', n: 's', animate: true }, { w: 'ילדה', g: 'f', n: 's', animate: true },
    { w: 'כלב', g: 'm', n: 's', animate: true }, { w: 'כלבה', g: 'f', n: 's', animate: true },
    { w: 'שולחן', g: 'm', n: 's' }, { w: 'מחברת', g: 'f', n: 's' },
    { w: 'בית', g: 'm', n: 's' }, { w: 'מכונית', g: 'f', n: 's' }, { w: 'בובה', g: 'f', n: 's' }, { w: 'סוס', g: 'm', n: 's', animate: true },
  ],
  [
    { w: 'ילדים', g: 'm', n: 'p', animate: true, one: 'ילד' }, { w: 'ילדות', g: 'f', n: 'p', animate: true, one: 'ילדה' },
    { w: 'ספרים', g: 'm', n: 'p', one: 'ספר' }, { w: 'מכוניות', g: 'f', n: 'p', one: 'מכונית' },
    { w: 'פרחים', g: 'm', n: 'p', one: 'פרח' }, { w: 'בובות', g: 'f', n: 'p', one: 'בובה' }, { w: 'חתולות', g: 'f', n: 'p', animate: true, one: 'חתולה' },
  ],
  [
    { w: 'עיר', g: 'f', n: 's', tricky: 'אין לה סוף של ה או ת, אבל אומרים "זאת עיר". היא נקבה.' },
    { w: 'ארץ', g: 'f', n: 's', tricky: 'אומרים "זאת ארץ", ולכן היא נקבה, גם בלי ה או ת בסוף.' },
    { w: 'אבן', g: 'f', n: 's', tricky: 'אומרים "זאת אבן". אבן היא נקבה.' },
    { w: 'ציפור', g: 'f', n: 's', animate: true, tricky: 'אומרים "זאת ציפור". ציפור היא נקבה.' },
    { w: 'חלונות', g: 'm', n: 'p', one: 'חלון', tricky: 'נגמר ב-ות, אבל אומרים "חלון אחד". חלונות הם זכר.' },
    { w: 'שולחנות', g: 'm', n: 'p', one: 'שולחן', tricky: 'נגמר ב-ות, אבל "שולחן" הוא זכר, ולכן גם שולחנות.' },
    { w: 'נשים', g: 'f', n: 'p', animate: true, one: 'אישה', tricky: 'נגמר ב-ים, אבל אישה היא נקבה, ולכן גם נשים.' },
    { w: 'נמלים', g: 'f', n: 'p', animate: true, one: 'נמלה', tricky: 'נגמר ב-ים, אבל "נמלה" היא נקבה, ולכן גם נמלים.' },
  ],
];
const ADJ: { forms: [string, string, string, string]; animateOnly?: boolean; inanimateOnly?: boolean }[] = [
  { forms: ['גדול', 'גדולה', 'גדולים', 'גדולות'] },
  { forms: ['קטן', 'קטנה', 'קטנים', 'קטנות'] },
  { forms: ['חדש', 'חדשה', 'חדשים', 'חדשות'] },
  { forms: ['ירוק', 'ירוקה', 'ירוקים', 'ירוקות'], inanimateOnly: true },
  { forms: ['נקי', 'נקייה', 'נקיים', 'נקיות'] },
  { forms: ['שמח', 'שמחה', 'שמחים', 'שמחות'], animateOnly: true },
  { forms: ['חזק', 'חזקה', 'חזקים', 'חזקות'] },
];
const formIndex = (g: G, n: N) => (n === 's' ? (g === 'm' ? 0 : 1) : g === 'm' ? 2 : 3);
const PRONOUN: Record<string, string> = { ms: 'זה', fs: 'זאת', mp: 'אלה', fp: 'אלה' };

function gender(rng: Rng, tier: 1 | 2 | 3): Draft {
  const noun = pick(rng, NOUNS[tier - 1]);
  const adj = pick(rng, ADJ.filter((a) => (!a.animateOnly || noun.animate) && (!a.inanimateOnly || !noun.animate)));
  const correct = adj.forms[formIndex(noun.g, noun.n)];
  const wrongSameNumber = adj.forms[formIndex(noun.g === 'm' ? 'f' : 'm', noun.n)];
  const feedback = noun.tricky ? { [wrongSameNumber]: noun.tricky } : undefined;
  const count = noun.n === 's' ? 'אחד או אחת' : 'הרבה';
  return choiceDraft(rng, {
    key: `${noun.w}-${adj.forms[0]}`,
    prompt: `איזו מילה משלימה נכון?\nה${noun.w} ____`,
    speech: `איזו מילה משלימה נכון? ה${noun.w}...`,
    correct,
    wrong: adj.forms.filter((f) => f !== correct),
    strategies: ['eliminate'],
    hints: hints3(
      'אסטרטגיה: לפסול תשובות ❌. בודקים שני דברים: אחד או הרבה? זכר או נקבה?',
      noun.n === 's'
        ? `"${noun.w}" זה ${count}. נסו להגיד: "${PRONOUN[noun.g + noun.n]} ${noun.w}".`
        : `"${noun.w}" זה הרבה. נסו להגיד על אחד: "זה ${noun.one}" או "זאת ${noun.one}"?`,
      `ה${noun.w} ${correct}`,
    ),
    explain: `ה${noun.w} ${correct}${noun.tricky ? `. ${noun.tricky}` : ''}`,
    feedback,
  });
}

// ---------- יחיד ורבים ----------

const PLURALS: [string, string, string][][] = [
  // tier 1 handled separately (pick the plural word)
  [],
  [
    ['כדור', 'כדורים', 'כדורות'], ['תמונה', 'תמונות', 'תמונים'], ['שמלה', 'שמלות', 'שמלים'], ['עט', 'עטים', 'עטות'],
    ['דג', 'דגים', 'דגות'], ['פרח', 'פרחים', 'פרחות'], ['מכונית', 'מכוניות', 'מכוניתים'], ['בובה', 'בובות', 'בובים'],
    ['תיק', 'תיקים', 'תיקות'], ['עוגה', 'עוגות', 'עוגים'],
  ],
  [
    ['שולחן', 'שולחנות', 'שולחנים'], ['חלון', 'חלונות', 'חלונים'], ['עיפרון', 'עפרונות', 'עיפרונים'], ['לילה', 'לילות', 'לילים'],
    ['מקום', 'מקומות', 'מקומים'], ['כיסא', 'כיסאות', 'כיסאים'], ['אבן', 'אבנים', 'אבנות'], ['נמלה', 'נמלים', 'נמלות'],
    ['דבורה', 'דבורים', 'דבורות'], ['יונה', 'יונים', 'יונות'],
  ],
];
const T1_PLURAL = ['ספרים', 'כלבים', 'בובות', 'מחברות', 'ילדים', 'עוגות', 'כדורים', 'פרחים'];
const T1_SINGULAR = ['ספר', 'כלב', 'בובה', 'מחברת', 'ילד', 'עוגה', 'כדור', 'פרח', 'שולחן', 'תיק'];

function number(rng: Rng, tier: 1 | 2 | 3): Draft {
  if (tier === 1) {
    const correct = pick(rng, T1_PLURAL);
    const wrong = shuffle(rng, T1_SINGULAR).slice(0, 3);
    return choiceDraft(rng, {
      key: `pick-${correct}`,
      prompt: 'איזו מילה היא ברבים (יותר מאחד)?',
      correct, wrong,
      strategies: ['pattern'],
      hints: hints3(
        'אסטרטגיה: לחפש תבנית 🔍. הרבה מילים ברבים נגמרות ב-ים או ב-ות.',
        'חפשו מילה שנגמרת ב-ים או ב-ות.',
        `${correct} = הרבה. למשל: "ספר אחד, הרבה ספרים".`,
      ),
      explain: `"${correct}" היא ברבים.`,
    });
  }
  const [sing, plural, wrongSuffix] = pick(rng, PLURALS[tier - 1]);
  const exceptional = tier === 3;
  return choiceDraft(rng, {
    key: sing,
    prompt: `מה הרבים של "${sing}"?`,
    correct: plural,
    wrong: [wrongSuffix, sing],
    strategies: exceptional ? ['look_back'] : ['pattern'],
    hints: hints3(
      exceptional
        ? 'זהירות, זו מילה יוצאת דופן! נסו להגיד את שתי האפשרויות בקול ולשמוע מה נשמע נכון.'
        : 'אסטרטגיה: לחפש תבנית 🔍. מילה בזכר בדרך כלל מקבלת ים, ומילה בנקבה בדרך כלל מקבלת ות.',
      `איך אומרים: "יש לי הרבה ___"?`,
      `${sing} אחד או אחת, הרבה ${plural}.`,
    ),
    explain: `${sing} ← ${plural}${exceptional ? '. זו מילה יוצאת דופן, כדאי לזכור אותה.' : ''}`,
    feedback: exceptional ? { [wrongSuffix]: `נשמע הגיוני לפי הכלל, אבל "${sing}" יוצאת דופן: אומרים "${plural}".` } : undefined,
  });
}

// ---------- סימני פיסוק ----------

const PUNCT: [string, '.' | '?' | '!'][][] = [
  [['מה השם שלך', '?'], ['איפה התיק שלי', '?'], ['מי רוצה לשחק', '?'], ['הכלב ישן על השטיח', '.'], ['היום יום ראשון', '.'], ['אני אוהב גלידה', '.']],
  [['איזה יום יפה', '!'], ['הידד, ניצחנו', '!'], ['היזהרו, זה חם', '!'], ['השמש שוקעת בערב', '.'], ['למה השמיים כחולים', '?'], ['כמה עולה הספר', '?']],
  [['אתם באים איתנו לים, נכון', '?'], ['איזה כיף שבאת', '!'], ['זהירות, מכונית', '!'], ['אמא אמרה שנלך מחר', '.'], ['הספקת לסיים את השיעורים, נכון', '?'], ['שאלתי אותו מה השעה', '.']],
];
const PUNCT_NAME = { '.': 'נקודה', '?': 'סימן שאלה', '!': 'סימן קריאה' };
const PUNCT_WHY = { '.': 'זה משפט שמספר משהו', '?': 'זו שאלה, מחכים לתשובה', '!': 'יש כאן רגש חזק: שמחה, הפתעה או אזהרה' };

function punct(rng: Rng, tier: 1 | 2 | 3): Draft {
  const [sentence, mark] = pick(rng, PUNCT[tier - 1]);
  const all = ['.', '?', '!'] as const;
  const feedback: Record<string, string> = {};
  if (tier === 3 && sentence === 'שאלתי אותו מה השעה') feedback['?'] = 'יש כאן מילת שאלה, אבל המשפט מספר מה קרה. הוא לא שואל אותנו. לכן שמים נקודה.';
  if (tier === 3 && mark === '?') feedback['.'] = 'אין כאן מילת שאלה כמו "מה" או "איפה", אבל אם קוראים בקול, הקול עולה בסוף. זו שאלה!';
  return choiceDraft(rng, {
    key: sentence,
    prompt: `איזה סימן חסר בסוף המשפט?\n${sentence} ___`,
    speech: `איזה סימן חסר בסוף המשפט? ${sentence}`,
    correct: mark,
    wrong: all.filter((m) => m !== mark),
    strategies: ['look_back'],
    hints: hints3(
      'אסטרטגיה: לחזור לטקסט 📖. קראו את המשפט בקול. איך הקול שלכם נשמע בסוף?',
      'שאלה → סימן שאלה. רגש חזק או אזהרה → סימן קריאה. סיפור רגיל → נקודה.',
      `${sentence}${mark}  (${PUNCT_NAME[mark]}: ${PUNCT_WHY[mark]})`,
    ),
    explain: `${sentence}${mark}  ${PUNCT_WHY[mark]}.`,
    feedback,
  });
}

// ---------- הפכים ונרדפות ----------

const OPPOSITES: [string, string, string?][][] = [
  [['גדול', 'קטן'], ['חם', 'קר'], ['יום', 'לילה'], ['פתוח', 'סגור'], ['למעלה', 'למטה'], ['שמח', 'עצוב']],
  [['ארוך', 'קצר'], ['כבד', 'קל'], ['מלא', 'ריק'], ['רחוק', 'קרוב'], ['מהיר', 'איטי'], ['חזק', 'חלש'], ['רטוב', 'יבש']],
  [['אמיץ', 'פחדן', 'גיבור'], ['עשיר', 'עני', 'אמיד'], ['לנצח', 'להפסיד', 'לזכות'], ['להתחיל', 'לסיים'], ['לזכור', 'לשכוח', 'להיזכר'], ['רועש', 'שקט', 'צעקני']],
];

function opposites(rng: Rng, tier: 1 | 2 | 3): Draft {
  const list = OPPOSITES[tier - 1];
  const [word, opp, trap] = pick(rng, list);
  const others = shuffle(rng, list.filter(([w]) => w !== word).map(([, o]) => o));
  const wrong = trap ? [trap, ...others.slice(0, 2)] : others.slice(0, 3);
  return choiceDraft(rng, {
    key: word,
    prompt: `מה ההפך של "${word}"?`,
    correct: opp, wrong,
    strategies: ['eliminate'],
    hints: hints3(
      'אסטרטגיה: לפסול תשובות ❌. הפך זה מילה שאומרת בדיוק את הצד השני.',
      `חשבו על משפט עם "${word}", ואז החליפו במילה שאומרת את הצד השני.`,
      `${word} ↔ ${opp}`,
    ),
    explain: `ההפך של "${word}" הוא "${opp}".`,
    feedback: trap ? { [trap]: `"${trap}" דומה ל"${word}". זו מילה נרדפת, לא הפוכה.` } : undefined,
  });
}

const SYNONYMS: [string, string, string][][] = [
  [['שמח', 'עליז', 'עצוב'], ['קטן', 'זעיר', 'גדול'], ['מהיר', 'זריז', 'איטי'], ['חבר', 'ידיד', 'אויב']],
  [['להסתכל', 'להביט', 'לעצום'], ['לדבר', 'לשוחח', 'לשתוק'], ['יפה', 'נאה', 'מכוער'], ['לרוץ', 'לדהור', 'לעמוד']],
  [['חכם', 'נבון', 'טיפש'], ['לצעוק', 'לזעוק', 'ללחוש'], ['מפחד', 'חושש', 'אמיץ'], ['מבקש', 'מתחנן', 'מסרב']],
];

function synonyms(rng: Rng, tier: 1 | 2 | 3): Draft {
  const list = SYNONYMS[tier - 1];
  const [word, syn, opp] = pick(rng, list);
  const others = shuffle(rng, list.filter(([w]) => w !== word).map(([, s]) => s)).slice(0, 2);
  return choiceDraft(rng, {
    key: word,
    prompt: `איזו מילה אומרת כמעט אותו דבר כמו "${word}"?`,
    correct: syn, wrong: [opp, ...others],
    strategies: ['eliminate'],
    hints: hints3(
      'אסטרטגיה: לפסול תשובות ❌. קודם מוחקים את המילה ההפוכה.',
      `נסו להחליף את "${word}" במשפט: האם המשמעות נשארת?`,
      `${word} = ${syn}`,
    ),
    explain: `"${word}" ו"${syn}" הן מילים נרדפות: המשמעות כמעט זהה.`,
    feedback: { [opp]: `"${opp}" היא ההפך של "${word}". חיפשנו מילה דומה.` },
  });
}

// ---------- משפחת מילים ושורש ----------

interface Family { base: string; same: string; d: [string, string]; root: string; rootWord: string }
const FAMILIES: Family[][] = [
  [
    { base: 'כתב', same: 'מכתב', d: ['כתף', 'כבש'], root: 'כ-ת-ב', rootWord: 'מכתב' },
    { base: 'שיחק', same: 'משחק', d: ['שקט', 'שחר'], root: 'ש-ח-ק', rootWord: 'משחק' },
    { base: 'אכל', same: 'מאכל', d: ['כלב', 'אלה'], root: 'א-כ-ל', rootWord: 'מאכל' },
    { base: 'שמר', same: 'שומר', d: ['שמש', 'מסמר'], root: 'ש-מ-ר', rootWord: 'שומר' },
  ],
  [
    { base: 'למד', same: 'תלמיד', d: ['לחם', 'מדף'], root: 'ל-מ-ד', rootWord: 'תלמיד' },
    { base: 'רקד', same: 'ריקוד', d: ['רכב', 'דרך'], root: 'ר-ק-ד', rootWord: 'ריקוד' },
    { base: 'חשב', same: 'מחשב', d: ['חשמל', 'שבת'], root: 'ח-ש-ב', rootWord: 'מחשב' },
    { base: 'גדל', same: 'מגדל', d: ['גדר', 'דלת'], root: 'ג-ד-ל', rootWord: 'מגדל' },
  ],
  [
    { base: 'זכר', same: 'זיכרון', d: ['זכוכית', 'כרית'], root: 'ז-כ-ר', rootWord: 'זיכרון' },
    { base: 'ספר', same: 'ספרייה', d: ['ספה', 'ספל'], root: 'ס-פ-ר', rootWord: 'ספרייה' },
    { base: 'בישל', same: 'תבשיל', d: ['בשר', 'שלג'], root: 'ב-ש-ל', rootWord: 'תבשיל' },
    { base: 'שלח', same: 'משלוח', d: ['שלג', 'לחם'], root: 'ש-ל-ח', rootWord: 'משלוח' },
  ],
];

function family(rng: Rng, tier: 1 | 2 | 3): Draft {
  const f = pick(rng, FAMILIES[tier - 1]);
  const other = pick(rng, FAMILIES[tier - 1].filter((x) => x !== f));
  return choiceDraft(rng, {
    key: f.base,
    prompt: `איזו מילה שייכת למשפחה של "${f.base}"?`,
    correct: f.same, wrong: [...f.d, other.same],
    strategies: ['pattern', 'eliminate'],
    hints: hints3(
      'אסטרטגיה: לחפש תבנית 🔍. במילים מאותה משפחה יש אותן שלוש אותיות, והמשמעות קשורה.',
      `האותיות של המשפחה הן ${f.root}. באיזו מילה מופיעות שלושתן, והמשמעות קשורה ל"${f.base}"?`,
      `${f.base} ו${f.same}: שתיהן מהשורש ${f.root}.`,
    ),
    explain: `"${f.same}" היא מאותה משפחה כמו "${f.base}" (שורש ${f.root}).`,
    feedback: { [f.d[0]]: `ב"${f.d[0]}" יש אותיות דומות, אבל המשמעות לא קשורה ל"${f.base}". משפחה צריכה גם אותיות וגם משמעות.` },
  });
}

function root(rng: Rng, tier: 1 | 2 | 3): Draft {
  const f = pick(rng, FAMILIES[tier - 1]);
  const others = shuffle(rng, FAMILIES.flat().filter((x) => x !== f)).slice(0, 1).map((x) => x.root);
  const letters = [...f.rootWord.replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c]!)];
  const firstThree = letters.slice(0, 3).join('-');
  const lastThree = letters.slice(-3).join('-');
  const wrong = [firstThree, lastThree, ...others].filter((w) => w !== f.root);
  return choiceDraft(rng, {
    key: f.rootWord,
    prompt: `מה השורש של המילה "${f.rootWord}"?`,
    correct: f.root, wrong,
    strategies: ['decompose', 'check_inverse'],
    hints: hints3(
      'אסטרטגיה: לפרק לחלקים 🧩. מורידים אותיות שנוספו מקדימה, מאחור או באמצע (מ, ת, ו, י, ון, ייה).',
      `חשבו על פעולה מאותה משפחה: "${f.base}". אילו אותיות משותפות?`,
      `${f.rootWord} ← ${f.base} ← השורש ${f.root}. בדיקה: אפשר ליצור עוד מילים מאותו שורש.`,
    ),
    explain: `השורש של "${f.rootWord}" הוא ${f.root}, כמו ב"${f.base}".`,
  });
}

// ---------- הבנת הנקרא ----------

interface Passage { id: string; text: string; qs: [QA, QA, QA] }
interface QA { q: string; correct: string; wrong: string[]; clue: string; explain: string }
const PASSAGES: Passage[] = [
  {
    id: 'kitten',
    text: 'נועה מצאה גור חתולים קטן ליד הגדר. הגור היה רטוב ורעד מקור. נועה עטפה אותו במגבת והביאה לו קערת חלב. אחרי כמה דקות הגור התחיל לגרגר.',
    qs: [
      { q: 'מה נועה מצאה ליד הגדר?', correct: 'גור חתולים', wrong: ['גור כלבים', 'ציפור קטנה', 'כדור'], clue: 'נועה מצאה', explain: 'כתוב במשפט הראשון: "נועה מצאה גור חתולים קטן ליד הגדר".' },
      { q: 'מה נועה עשתה ראשון, מיד אחרי שמצאה את הגור?', correct: 'עטפה את הגור במגבת', wrong: ['נתנה לו חלב', 'לקחה אותו לווטרינר', 'השאירה אותו ליד הגדר'], clue: 'נועה עטפה', explain: 'קודם היא עטפה אותו במגבת, ורק אחר כך הביאה חלב.' },
      { q: 'איך כנראה הרגיש הגור בסוף?', correct: 'רגוע ומרוצה', wrong: ['מפוחד', 'כועס', 'עדיין רועד מקור'], clue: 'התחיל לגרגר', explain: 'חתולים מגרגרים כשנעים להם. זה לא כתוב במפורש, מסיקים את זה מהרמז.' },
    ],
  },
  {
    id: 'tower',
    text: 'איתי רצה לבנות מגדל גבוה מקוביות. בכל פעם שהמגדל הגיע לעשר קוביות, הוא נפל. אבא הציע לשים את הקוביות הגדולות למטה. הפעם המגדל עמד יציב.',
    qs: [
      { q: 'ממה איתי בנה את המגדל?', correct: 'מקוביות', wrong: ['מקלפים', 'מחול', 'מספרים'], clue: 'מגדל גבוה מקוביות', explain: 'כתוב: "לבנות מגדל גבוה מקוביות".' },
      { q: 'מה קרה כשהמגדל הגיע לעשר קוביות?', correct: 'הוא נפל', wrong: ['אבא צילם אותו', 'איתי הפסיק לבנות', 'הוא נהיה צבעוני'], clue: 'עשר קוביות', explain: 'כתוב: "בכל פעם שהמגדל הגיע לעשר קוביות, הוא נפל".' },
      { q: 'למה המגדל עמד יציב בסוף?', correct: 'כי הקוביות הגדולות היו למטה', wrong: ['כי איתי בנה מהר יותר', 'כי אבא החזיק אותו', 'כי היו בו פחות קוביות'], clue: 'הקוביות הגדולות למטה', explain: 'אחרי העצה של אבא המגדל עמד. בסיס רחב וכבד עוזר למגדל לעמוד.' },
    ],
  },
  {
    id: 'rain',
    text: 'בבוקר השמיים היו אפורים ורוח חזקה נשבה. מאיה לקחה מעיל ומטרייה לבית הספר. בדרך הביתה היא שמחה שלקחה אותם.',
    qs: [
      { q: 'מה מאיה לקחה לבית הספר?', correct: 'מעיל ומטרייה', wrong: ['כובע ומשקפי שמש', 'כדור וחטיף', 'רק תיק'], clue: 'מאיה לקחה', explain: 'כתוב: "מאיה לקחה מעיל ומטרייה".' },
      { q: 'איך נראו השמיים בבוקר?', correct: 'אפורים', wrong: ['כחולים ובהירים', 'ורודים', 'מלאים בכוכבים'], clue: 'השמיים היו', explain: 'כתוב במשפט הראשון: "השמיים היו אפורים".' },
      { q: 'מה כנראה קרה בדרך הביתה?', correct: 'ירד גשם', wrong: ['היה חם מאוד', 'השמש זרחה חזק', 'מאיה איבדה את המטרייה'], clue: 'שמחה שלקחה אותם', explain: 'היא שמחה שהיו לה מעיל ומטרייה, ולכן כנראה ירד גשם. מסיקים מהרמזים.' },
    ],
  },
  {
    id: 'bees',
    text: 'הדבורים עפות מפרח לפרח ואוספות צוף. מהצוף הן מכינות דבש בכוורת. בזמן שהן עפות, הן מעבירות אבקה בין הפרחים, וכך עוזרות לצמחים ליצור פירות.',
    qs: [
      { q: 'מה הדבורים אוספות מהפרחים?', correct: 'צוף', wrong: ['מים', 'עלים', 'אבנים קטנות'], clue: 'אוספות צוף', explain: 'כתוב: "עפות מפרח לפרח ואוספות צוף".' },
      { q: 'איפה הדבורים מכינות דבש?', correct: 'בכוורת', wrong: ['בתוך הפרח', 'מתחת לאדמה', 'על העלים'], clue: 'דבש בכוורת', explain: 'כתוב: "מהצוף הן מכינות דבש בכוורת".' },
      { q: 'מה היה קורה לצמחים בלי דבורים?', correct: 'היו פחות פירות', wrong: ['היו יותר פרחים', 'הצמחים היו גדלים מהר יותר', 'לא היה משתנה כלום'], clue: 'עוזרות לצמחים ליצור פירות', explain: 'הדבורים עוזרות ליצור פירות, ולכן בלעדיהן היו פחות פירות.' },
    ],
  },
  {
    id: 'sandwich',
    text: 'עומר שכח את הכריך שלו בבית. בהפסקה הוא ישב לבד והסתכל על החברים אוכלים. תמר ראתה אותו, חצתה את הכריך שלה לשניים ונתנה לו חצי.',
    qs: [
      { q: 'מה עומר שכח בבית?', correct: 'את הכריך', wrong: ['את התיק', 'את הכדור', 'את המעיל'], clue: 'שכח את', explain: 'כתוב במשפט הראשון: "עומר שכח את הכריך שלו בבית".' },
      { q: 'מה תמר עשתה?', correct: 'נתנה לעומר חצי מהכריך שלה', wrong: ['קנתה לו כריך חדש', 'סיפרה למורה', 'שיחקה עם החברים'], clue: 'תמר ראתה', explain: 'כתוב: "חצתה את הכריך שלה לשניים ונתנה לו חצי".' },
      { q: 'איך כנראה הרגיש עומר כשישב לבד?', correct: 'עצוב ורעב', wrong: ['שמח ורגוע', 'כועס על תמר', 'גאה בעצמו'], clue: 'ישב לבד והסתכל', explain: 'הוא ישב לבד והסתכל על אחרים אוכלים, בלי אוכל משלו. מסיקים שהוא היה עצוב ורעב.' },
    ],
  },
  {
    id: 'sandcastle',
    text: 'ביום שישי המשפחה של יונתן נסעה לים. יונתן בנה ארמון חול ליד המים. אחרי שעה, גל גדול הגיע והרס את הארמון. יונתן צחק והתחיל לבנות ארמון חדש, הפעם רחוק יותר מהמים.',
    qs: [
      { q: 'לאן נסעה המשפחה?', correct: 'לים', wrong: ['ליער', 'להרים', 'לפארק'], clue: 'נסעה ל', explain: 'כתוב: "המשפחה של יונתן נסעה לים".' },
      { q: 'מה הרס את הארמון?', correct: 'גל גדול', wrong: ['כלב', 'הרוח', 'אחותו של יונתן'], clue: 'הרס את הארמון', explain: 'כתוב: "גל גדול הגיע והרס את הארמון".' },
      { q: 'למה יונתן בנה את הארמון החדש רחוק יותר מהמים?', correct: 'כדי שהגלים לא יהרסו אותו', wrong: ['כי שם היה יותר חול', 'כי אבא ביקש', 'כדי להיות ליד המשפחה'], clue: 'רחוק יותר מהמים', explain: 'יונתן למד מהטעות: ליד המים הגלים הורסים. זו הסקה, לא משהו שכתוב במפורש.' },
    ],
  },
];

function reading(rng: Rng, tier: 1 | 2 | 3): Draft {
  const p = pick(rng, PASSAGES);
  const qa = p.qs[tier - 1];
  const inference = tier === 3;
  return choiceDraft(rng, {
    key: `${p.id}-${tier}`,
    passage: p.text,
    prompt: qa.q,
    correct: qa.correct, wrong: qa.wrong,
    strategies: inference ? ['look_back', 'eliminate'] : ['look_back'],
    hints: hints3(
      inference
        ? 'אסטרטגיה: לחזור לטקסט 📖. התשובה לא כתובה במפורש. מחפשים רמז ומסיקים.'
        : 'אסטרטגיה: לחזור לטקסט 📖. התשובה כתובה בסיפור. חפשו אותה.',
      `חפשו בטקסט את המילים: "${qa.clue}".`,
      qa.explain,
    ),
    explain: qa.explain,
  });
}

export const LANGUAGE_GENERATORS: Record<string, (rng: Rng, tier: 1 | 2 | 3) => Draft> = {
  l_gender: gender,
  l_number: number,
  l_punct: punct,
  l_opposites: opposites,
  l_synonyms: synonyms,
  l_family: family,
  l_root: root,
  l_read: reading,
};
