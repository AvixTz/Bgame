import { NODE_BY_ID } from './curriculum';
import type { Hint, Item, MistakeType, StrategyId } from './types';
import { pick, randInt, shuffle, type Rng } from '../core/rng';

type Tier = 1 | 2 | 3;
type Draft = Omit<Item, 'id' | 'nodeId' | 'tier' | 'difficulty'> & { key: string };

const hints = (a: string, b: string, c: string): [Hint, Hint, Hint] => [
  { level: 1, text: a },
  { level: 2, text: b },
  { level: 3, text: c },
];

const tens = (n: number) => Math.floor(n / 10);
const units = (n: number) => n % 10;

// ---------- grade ב ----------

function place(rng: Rng, tier: Tier): Draft {
  if (tier === 1) {
    const n = randInt(rng, 11, 99);
    const askTens = rng() < 0.5 || units(n) === 0;
    const answer = askTens ? tens(n) : units(n);
    const what = askTens ? 'עשרות' : 'יחידות';
    return {
      key: `${n}${askTens ? 't' : 'u'}`,
      prompt: `כמה ${what} יש במספר ${n}?`,
      speech: `כמה ${what} יש במספר ${n}?`,
      answer,
      strategies: ['decompose'],
      hints: hints(
        'אסטרטגיה: לפרק לחלקים 🧩. כל מספר דו-ספרתי בנוי מעשרות ויחידות.',
        askTens ? `הספרה השמאלית ב-${n} מראה כמה עשרות יש.` : `הספרה הימנית ב-${n} מראה כמה יחידות יש.`,
        `${n} = ${tens(n) * 10} + ${units(n)}, כלומר ${tens(n)} עשרות ו-${units(n)} יחידות.`,
      ),
      explain: `${n} = ${tens(n) * 10} + ${units(n)}`,
    };
  }
  if (tier === 2) {
    const t = randInt(rng, 1, 9);
    const u = randInt(rng, 0, 9);
    const n = t * 10 + u;
    return {
      key: `${t}-${u}`,
      prompt: `${t} עשרות ו-${u} יחידות. איזה מספר זה?`,
      speech: `${t} עשרות ו-${u} יחידות. איזה מספר זה?`,
      answer: n,
      strategies: ['decompose'],
      hints: hints(
        'אסטרטגיה: לפרק לחלקים 🧩. בונים את המספר מעשרות ויחידות.',
        `${t} עשרות הן ${t * 10}. עכשיו מוסיפים את היחידות.`,
        `${t * 10} + ${u} = ${n}`,
      ),
      explain: `${t * 10} + ${u} = ${n}`,
    };
  }
  const h = randInt(rng, 1, 9);
  const t = randInt(rng, 0, 9);
  const u = randInt(rng, 0, 9);
  const n = h * 100 + t * 10 + u;
  return {
    key: `${h}-${t}-${u}`,
    prompt: `${h} מאות, ${t} עשרות ו-${u} יחידות. איזה מספר זה?`,
    speech: `${h} מאות, ${t} עשרות ו-${u} יחידות. איזה מספר זה?`,
    answer: n,
    strategies: ['decompose', 'pattern'],
    hints: hints(
      'אסטרטגיה: לפרק לחלקים 🧩. מאות, אחריהן עשרות ובסוף יחידות.',
      `${h} מאות הן ${h * 100}, ו-${t} עשרות הן ${t * 10}.`,
      `${h * 100} + ${t * 10} + ${u} = ${n}`,
    ),
    explain: `${h * 100} + ${t * 10} + ${u} = ${n}`,
  };
}

function addNoCarry(rng: Rng, tier: Tier): Draft {
  let a: number, b: number;
  if (tier === 1) {
    a = randInt(rng, 1, 8) * 10;
    b = randInt(rng, 1, 9 - a / 10) * 10;
  } else if (tier === 2) {
    a = randInt(rng, 11, 89);
    b = randInt(rng, 1, 9 - units(a));
    if (units(a) === 9) { a -= 1; b = 1; }
  } else {
    const at = randInt(rng, 1, 8), bt = randInt(rng, 1, 9 - at);
    const au = randInt(rng, 0, 8), bu = randInt(rng, 1, 9 - au);
    a = at * 10 + au; b = bt * 10 + bu;
  }
  return additionDraft(a, b, false);
}

function additionDraft(a: number, b: number, carry: boolean, c?: number): Draft {
  const sum = a + b + (c ?? 0);
  const expr = c === undefined ? `${a} + ${b}` : `${a} + ${b} + ${c}`;
  const strategies: StrategyId[] = carry ? ['decompose', 'estimate'] : ['decompose'];
  const step2 = c !== undefined
    ? `קודם ${a} + ${b} = ${a + b}, ואז מוסיפים ${c}.`
    : `קודם העשרות: ${tens(a) * 10} + ${tens(b) * 10} = ${(tens(a) + tens(b)) * 10}. אחר כך היחידות: ${units(a)} + ${units(b)} = ${units(a) + units(b)}.`;
  return {
    key: expr,
    prompt: 'כמה זה?',
    expr,
    speech: c === undefined ? `${a} ועוד ${b}` : `${a} ועוד ${b} ועוד ${c}`,
    answer: sum,
    strategies,
    hints: hints(
      carry
        ? 'אסטרטגיה: לפרק לחלקים 🧩. עשרות לחוד, יחידות לחוד. ואם היחידות עוברות 9, יש עוד עשרת!'
        : 'אסטרטגיה: לפרק לחלקים 🧩. עשרות לחוד, יחידות לחוד.',
      step2,
      c !== undefined
        ? `${a} + ${b} = ${a + b}, ${a + b} + ${c} = ${sum}`
        : `${(tens(a) + tens(b)) * 10} + ${units(a) + units(b)} = ${sum}`,
    ),
    explain: `${expr} = ${sum}`,
  };
}

function addCarry(rng: Rng, tier: Tier): Draft {
  if (tier === 1) {
    const au = randInt(rng, 2, 9);
    const bu = randInt(rng, 10 - au, 9);
    const a = randInt(rng, 1, 8) * 10 + au;
    return additionDraft(a, bu, true);
  }
  if (tier === 2) {
    const au = randInt(rng, 2, 9), bu = randInt(rng, 10 - au, 9);
    const at = randInt(rng, 1, 7), bt = randInt(rng, 1, 8 - at);
    return additionDraft(at * 10 + au, bt * 10 + bu, true);
  }
  // three addends, at least one carry, total <= 99
  for (;;) {
    const a = randInt(rng, 11, 45), b = randInt(rng, 5, 30), c = randInt(rng, 5, 25);
    if (a + b + c <= 99 && units(a) + units(b) + units(c) >= 10) return additionDraft(a, b, true, c);
  }
}

function subtractionDraft(a: number, b: number, borrow: boolean): Draft {
  const d = a - b;
  const expr = `${a} − ${b}`;
  return {
    key: expr,
    prompt: 'כמה זה?',
    expr,
    speech: `${a} פחות ${b}`,
    answer: d,
    strategies: borrow ? ['decompose', 'check_inverse'] : ['decompose', 'check_inverse'],
    hints: hints(
      borrow
        ? `אסטרטגיה: לפרק לחלקים 🧩. ביחידות ${units(a)} קטן מ-${units(b)}, אז פורטים עשרת אחת ל-10 יחידות.`
        : 'אסטרטגיה: לפרק לחלקים 🧩. מורידים עשרות מעשרות ויחידות מיחידות.',
      borrow
        ? `${a} = ${(tens(a) - 1) * 10} + ${units(a) + 10}. עכשיו ${units(a) + 10} − ${units(b)} = ${units(a) + 10 - units(b)}.`
        : `עשרות: ${tens(a) * 10} − ${tens(b) * 10} = ${(tens(a) - tens(b)) * 10}. יחידות: ${units(a)} − ${units(b)} = ${units(a) - units(b)}.`,
      `${expr} = ${d}. בדיקה בדרך ההפוכה 🔄: ${d} + ${b} = ${a}`,
    ),
    explain: `${expr} = ${d}, כי ${d} + ${b} = ${a}`,
  };
}

function subNoBorrow(rng: Rng, tier: Tier): Draft {
  if (tier === 1) {
    const a = randInt(rng, 2, 9) * 10;
    return subtractionDraft(a, randInt(rng, 1, a / 10 - 1) * 10, false);
  }
  if (tier === 2) {
    const a = randInt(rng, 12, 99);
    const au = units(a) === 0 ? 1 : units(a);
    const aa = tens(a) * 10 + au;
    return subtractionDraft(aa, randInt(rng, 1, au), false);
  }
  const at = randInt(rng, 2, 9), bt = randInt(rng, 1, at - 1);
  const au = randInt(rng, 1, 9), bu = randInt(rng, 0, au);
  return subtractionDraft(at * 10 + au, bt * 10 + bu, false);
}

function subBorrow(rng: Rng, tier: Tier): Draft {
  if (tier === 1) {
    const au = randInt(rng, 0, 8), bu = randInt(rng, au + 1, 9);
    return subtractionDraft(randInt(rng, 2, 9) * 10 + au, bu, true);
  }
  if (tier === 2) {
    const au = randInt(rng, 0, 8), bu = randInt(rng, au + 1, 9);
    const at = randInt(rng, 3, 9), bt = randInt(rng, 1, at - 2);
    return subtractionDraft(at * 10 + au, bt * 10 + bu, true);
  }
  const a = pick(rng, [100, 90, 80, 70, 60]);
  const bu = randInt(rng, 1, 9);
  const bt = randInt(rng, 1, a / 10 - 2);
  return subtractionDraft(a, bt * 10 + bu, true);
}

function missing(rng: Rng, tier: Tier): Draft {
  let a: number, total: number, form: 'add' | 'sub';
  if (tier === 1) {
    a = randInt(rng, 1, 9) * 10; total = 100; form = 'add';
  } else if (tier === 2) {
    a = randInt(rng, 11, 89);
    total = Math.ceil((a + 1) / 10) * 10; form = 'add';
  } else {
    form = 'sub';
    a = randInt(rng, 12, 39); total = randInt(rng, 11, 49); // ? - a = total
  }
  if (form === 'add') {
    const ans = total - a;
    const expr = `${a} + ☐ = ${total}`;
    return {
      key: expr, prompt: 'איזה מספר חסר?', expr,
      speech: `${a} ועוד כמה שווה ${total}?`,
      answer: ans,
      strategies: ['check_inverse', 'decompose'],
      hints: hints(
        'אסטרטגיה: לבדוק בדרך ההפוכה 🔄. חיבור עם מספר חסר נפתר בחיסור.',
        `כמה חסר מ-${a} כדי להגיע ל-${total}? אפשר לחשב ${total} − ${a}.`,
        `${total} − ${a} = ${ans}, ובדיקה: ${a} + ${ans} = ${total}`,
      ),
      explain: `${a} + ${ans} = ${total}`,
    };
  }
  const ans = total + a;
  const expr = `☐ − ${a} = ${total}`;
  return {
    key: expr, prompt: 'איזה מספר חסר?', expr,
    speech: `איזה מספר פחות ${a} שווה ${total}?`,
    answer: ans,
    strategies: ['check_inverse'],
    hints: hints(
      'אסטרטגיה: לבדוק בדרך ההפוכה 🔄. אם הורדנו והגענו לתוצאה, מחברים כדי לחזור להתחלה.',
      `המספר החסר הוא ${total} + ${a}.`,
      `${total} + ${a} = ${ans}, ובדיקה: ${ans} − ${a} = ${total}`,
    ),
    explain: `${ans} − ${a} = ${total}`,
  };
}

const OBJECTS = ['🍎', '⭐', '🐟', '🎈', '🍪', '💎'];

function multDraft(a: number, b: number, strategies: StrategyId[], factHint: string): Draft {
  const p = a * b;
  const expr = `${a} × ${b}`;
  return {
    key: expr, prompt: 'כמה זה?', expr,
    speech: `${a} כפול ${b}`,
    answer: p,
    strategies,
    hints: hints(
      factHint,
      b <= 5
        ? `ספירה בקפיצות של ${a}: ${Array.from({ length: b }, (_, i) => a * (i + 1)).join(', ')}`
        : `${a} × 5 = ${a * 5}. עכשיו מוסיפים עוד ${b - 5} פעמים ${a}.`,
      `${expr} = ${p}`,
    ),
    explain: `${expr} = ${p}`,
  };
}

function multIntro(rng: Rng, tier: Tier): Draft {
  if (tier === 1) {
    const groups = randInt(rng, 2, 5), each = pick(rng, [2, 5, 2, 3]);
    const obj = pick(rng, OBJECTS);
    const pic = Array.from({ length: groups }, () => obj.repeat(each)).join('  ');
    return {
      key: `g${groups}x${each}`,
      prompt: `${groups} קבוצות, ובכל קבוצה ${each}. כמה יש בסך הכל?\n${pic}`,
      expr: `${groups} × ${each}`,
      speech: `${groups} קבוצות, ובכל קבוצה ${each}. כמה יש בסך הכל?`,
      answer: groups * each,
      strategies: ['draw', 'pattern'],
      hints: hints(
        'אסטרטגיה: לצייר את הבעיה ✏️. ספרו כל קבוצה.',
        `חיבור חוזר: ${Array(groups).fill(each).join(' + ')}`,
        `${Array(groups).fill(each).join(' + ')} = ${groups * each}, כלומר ${groups} × ${each} = ${groups * each}`,
      ),
      explain: `${groups} × ${each} = ${groups * each}`,
    };
  }
  const a = pick(rng, [2, 5, 10]);
  const b = tier === 2 ? randInt(rng, 1, 5) : randInt(rng, 6, 10);
  return multDraft(a, b, ['pattern'], `אסטרטגיה: לחפש תבנית 🔍. בקפיצות של ${a} יש סדר קבוע.`);
}

function factHintFor(a: number): string {
  switch (a) {
    case 9: return 'אסטרטגיה: להשתמש במה שאני יודע 💡. 9 פעמים = 10 פעמים פחות פעם אחת.';
    case 4: return 'אסטרטגיה: להשתמש במה שאני יודע 💡. כפול 4 זה כפול 2, ועוד פעם כפול 2.';
    case 6: return 'אסטרטגיה: להשתמש במה שאני יודע 💡. כפול 6 זה כפול 5 ועוד פעם אחת.';
    case 8: return 'אסטרטגיה: להשתמש במה שאני יודע 💡. כפול 8 זה כפול 4 פעמיים.';
    case 7: return 'אסטרטגיה: להשתמש במה שאני יודע 💡. כפול 7 זה כפול 5 ועוד כפול 2.';
    case 3: return 'אסטרטגיה: להשתמש במה שאני יודע 💡. כפול 3 זה כפול 2 ועוד פעם אחת.';
    case 10: return 'אסטרטגיה: לחפש תבנית 🔍. כפול 10 מוסיף 0 בסוף.';
    case 5: return 'אסטרטגיה: לחפש תבנית 🔍. בכפול 5 התוצאה נגמרת תמיד ב-0 או ב-5.';
    default: return 'אסטרטגיה: לחפש תבנית 🔍. ספירה בקפיצות.';
  }
}

function multTable(rng: Rng, tier: Tier, sets: [number[], number[], number[]], small: [boolean, boolean, boolean]): Draft {
  const a = pick(rng, sets[tier - 1]);
  const b = small[tier - 1] ? randInt(rng, 1, 5) : randInt(rng, 2, 10);
  const [x, y] = rng() < 0.5 ? [a, b] : [b, a];
  const strategies: StrategyId[] = [3, 4, 6, 7, 8, 9].includes(a) ? ['known_fact', 'pattern'] : ['pattern'];
  // Hints are phrased around `a` (the table being practised); keep a first in hint text by passing a, b.
  const d = multDraft(a, b, strategies, factHintFor(a));
  return { ...d, key: `${x} × ${y}`, expr: `${x} × ${y}`, speech: `${x} כפול ${y}`, explain: `${x} × ${y} = ${a * b}` };
}

function divDraft(rng: Rng, tier: Tier): Draft {
  const b = pick(rng, [[2, 5, 10], [3, 4], [6, 7, 8, 9]][tier - 1]);
  const q = randInt(rng, 2, 10);
  const a = b * q;
  const expr = `${a} : ${b}`;
  return {
    key: expr, prompt: 'כמה זה?', expr,
    speech: `${a} לחלק ל-${b}`,
    answer: q,
    strategies: ['check_inverse', 'known_fact'],
    hints: hints(
      'אסטרטגיה: לבדוק בדרך ההפוכה 🔄. חילוק הוא כפל הפוך.',
      `איזה מספר כפול ${b} שווה ${a}?  ${b} × ☐ = ${a}`,
      `${b} × ${q} = ${a}, ולכן ${a} : ${b} = ${q}`,
    ),
    explain: `${a} : ${b} = ${q}, כי ${b} × ${q} = ${a}`,
  };
}

const remLabel = (q: number, r: number) => (r === 0 ? `${q}` : `${q} (שארית ${r})`);

function divRem(rng: Rng, tier: Tier): Draft {
  const b = pick(rng, [[2, 5, 10], [3, 4], [6, 7, 8, 9]][tier - 1]);
  const q = randInt(rng, 2, 9);
  const r = randInt(rng, 1, b - 1);
  const a = b * q + r;
  const correct = remLabel(q, r);
  const pool = new Set<string>([correct]);
  const candidates = [remLabel(q - 1, r + b), remLabel(q + 1, r), remLabel(q, r === 1 ? 2 : r - 1), remLabel(q - 1, r)];
  for (const c of candidates) { if (pool.size < 4 && !pool.has(c) && !c.startsWith('0') && !c.startsWith('-')) pool.add(c); }
  const expr = `${a} : ${b}`;
  return {
    key: expr, prompt: 'כמה זה?', expr,
    speech: `${a} לחלק ל-${b}`,
    answer: q * 100 + r,
    choices: shuffle(rng, [...pool]),
    correctChoice: correct,
    strategies: ['known_fact', 'check_inverse'],
    hints: hints(
      'אסטרטגיה: להשתמש במה שאני יודע 💡. מחפשים את המכפלה הגדולה ביותר שלא עוברת את המספר.',
      `${b} × ${q} = ${b * q}, ו-${b} × ${q + 1} = ${b * (q + 1)} כבר גדול מ-${a}.`,
      `${a} = ${b} × ${q} + ${r}, ולכן ${q} ושארית ${r}. השארית קטנה מ-${b}.`,
    ),
    explain: `${a} = ${b} × ${q} + ${r}`,
  };
}

const NAMES: [string, 'm' | 'f'][] = [
  ['נועה', 'f'], ['איתי', 'm'], ['מאיה', 'f'], ['עומר', 'm'], ['תמר', 'f'],
  ['יונתן', 'm'], ['שירה', 'f'], ['אדם', 'm'], ['ליה', 'f'], ['נדב', 'm'],
];

function word(rng: Rng, tier: Tier): Draft {
  const [name, nameGender] = pick(rng, NAMES);
  if (tier === 1) {
    const a = randInt(rng, 2, 6), b = randInt(rng, 2, 6);
    return {
      key: `w1-${a}-${b}`,
      prompt: `ל${name} יש ${a} קופסאות, ובכל קופסה ${b} עפרונות. כמה עפרונות יש בסך הכל?`,
      speech: `ל${name} יש ${a} קופסאות, ובכל קופסה ${b} עפרונות. כמה עפרונות יש בסך הכל?`,
      answer: a * b,
      strategies: ['draw', 'decompose'],
      hints: hints(
        'אסטרטגיה: לצייר את הבעיה ✏️. ציירו את הקופסאות ואת העפרונות שבתוכן.',
        `יש ${a} קבוצות שוות של ${b}. איזה תרגיל זה?`,
        `${a} × ${b} = ${a * b}`,
      ),
      explain: `${a} × ${b} = ${a * b}`,
    };
  }
  if (tier === 2) {
    const k = randInt(rng, 2, 6), each = randInt(rng, 2, 8);
    const n = k * each;
    return {
      key: `w2-${n}-${k}`,
      prompt: `${name} ${nameGender === 'f' ? 'מחלקת' : 'מחלק'} ${n} סוכריות שווה בשווה בין ${k} חברים. כמה סוכריות מקבל כל חבר?`,
      speech: `${n} סוכריות מתחלקות שווה בשווה בין ${k} חברים. כמה מקבל כל חבר?`,
      answer: each,
      strategies: ['draw', 'check_inverse'],
      hints: hints(
        'אסטרטגיה: לצייר את הבעיה ✏️. ציירו חברים ותחלקו להם סוכריות אחת-אחת.',
        `זה חילוק: ${n} : ${k}. איזה מספר כפול ${k} נותן ${n}?`,
        `${n} : ${k} = ${each}, כי ${k} × ${each} = ${n}`,
      ),
      explain: `${n} : ${k} = ${each}`,
    };
  }
  const rows = randInt(rng, 3, 6), per = randInt(rng, 4, 8);
  const taken = randInt(rng, 3, rows * per - 3);
  return {
    key: `w3-${rows}-${per}-${taken}`,
    prompt: `באולם יש ${rows} שורות, ובכל שורה ${per} כיסאות. ${taken} כיסאות כבר תפוסים. כמה כיסאות פנויים?`,
    speech: `באולם יש ${rows} שורות, ובכל שורה ${per} כיסאות. ${taken} כיסאות תפוסים. כמה פנויים?`,
    answer: rows * per - taken,
    strategies: ['decompose', 'draw'],
    hints: hints(
      'אסטרטגיה: לפרק לחלקים 🧩. זו בעיה בשני צעדים.',
      `צעד 1: כמה כיסאות יש בכלל? ${rows} × ${per}. צעד 2: מורידים את התפוסים.`,
      `${rows} × ${per} = ${rows * per}, ${rows * per} − ${taken} = ${rows * per - taken}`,
    ),
    explain: `${rows} × ${per} − ${taken} = ${rows * per - taken}`,
  };
}

const GENERATORS: Record<string, (rng: Rng, tier: Tier) => Draft> = {
  b_place: place,
  b_add: addNoCarry,
  b_sub: subNoBorrow,
  b_add_carry: addCarry,
  b_sub_borrow: subBorrow,
  b_missing: missing,
  b_mult_intro: multIntro,
  g_mult_easy: (r, t) => multTable(r, t, [[1, 10], [2, 5], [2, 5, 10]], [false, true, false]),
  g_mult_mid: (r, t) => multTable(r, t, [[3], [3, 4], [6]], [true, false, false]),
  g_mult_hard: (r, t) => multTable(r, t, [[9], [7, 8], [7, 8, 9]], [true, true, false]),
  g_div: divDraft,
  g_div_rem: divRem,
  g_word: word,
};

export function generateItem(nodeId: string, tier: Tier, rng: Rng): Item {
  const node = NODE_BY_ID[nodeId];
  const gen = GENERATORS[nodeId];
  if (!node || !gen) throw new Error(`Unknown node ${nodeId}`);
  const { key, ...d } = gen(rng, tier);
  return { ...d, id: `${nodeId}:${key}`, nodeId, tier, difficulty: node.tierDifficulty[tier - 1] };
}

/** Classify a wrong numeric answer into a mistake pattern the parent report can use. */
export function classifyMistake(item: Item, given: string): MistakeType {
  if (item.choices) {
    const m = given.match(/שארית (\d+)/);
    const divisor = Number(item.expr?.split(':')[1]);
    if (m && Number(m[1]) >= divisor) return 'remainder_too_big';
    const q = parseInt(given, 10);
    if (Math.abs(q - Math.floor(item.answer / 100)) === 1) return 'off_by_one';
    return 'other';
  }
  const v = Number(given);
  if (!Number.isFinite(v)) return 'other';
  const ans = item.answer;
  const nums = (item.expr ?? '').match(/\d+/g)?.map(Number) ?? [];
  const [a, b] = nums;
  const expr = item.expr ?? '';

  if (item.nodeId === 'b_place' || /^\d\d$/.test(String(ans))) {
    const rev = Number(String(ans).split('').reverse().join(''));
    if (ans >= 10 && ans < 100 && v === rev && v !== ans) return 'swapped_digits';
  }
  if (expr.includes('+') && !expr.includes('☐') && a !== undefined && b !== undefined && nums.length === 2) {
    if (v === ans - 10 && units(a) + units(b) >= 10) return 'forgot_carry';
    const concat = Number(`${tens(a) + tens(b)}${units(a) + units(b)}`);
    if (units(a) + units(b) >= 10 && v === concat) return 'digit_concat';
    if (v === a - b || v === a * b) return 'wrong_operation';
  }
  if (expr.includes('−') && !expr.includes('☐') && a !== undefined && b !== undefined) {
    const sfl = (tens(a) - tens(b)) * 10 + Math.abs(units(a) - units(b));
    if (units(a) < units(b) && v === sfl) return 'smaller_from_larger';
    if (units(a) < units(b) && v === ans + 10) return 'forgot_borrow';
    if (v === a + b) return 'wrong_operation';
  }
  if (expr.includes('×') && a !== undefined && b !== undefined) {
    if (v === a + b) return 'wrong_operation';
    if (v === a * (b + 1) || v === a * (b - 1) || v === b * (a + 1) || v === b * (a - 1)) return 'skip_count_slip';
  }
  if (expr.includes(':') && a !== undefined && b !== undefined) {
    if (v === a * b || v === a - b) return 'wrong_operation';
    if (Math.abs(v - ans) === 1) return 'skip_count_slip';
  }
  if (expr.includes('☐') && a !== undefined && b !== undefined) {
    if (v === a + b) return 'wrong_operation';
  }
  if (Math.abs(v - ans) === 1) return 'off_by_one';
  if (Math.abs(v - ans) === 10) return 'off_by_ten';
  return 'other';
}
