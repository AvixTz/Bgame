import type { CurriculumNode, MistakeType, StrategyId } from './types';

/**
 * Math curriculum nodes for grades ב-ג.
 * Based on the Ministry of Education new primary math program (grade ב from תשפ"ו, grade ג from תשפ"ז)
 * and the 2006 program (multiplication-table mastery in grade ג). Needs review by a teacher.
 */
export const MATH_NODES: CurriculumNode[] = [
  {
    id: 'b_place', subject: 'math', grade: 2, strand: 'number',
    title: 'עשרות ויחידות', short: 'עשרות ויחידות',
    prerequisites: [], tierDifficulty: [-1.6, -0.8, 0.2], curriculumVersion: 'new-2023',
  },
  {
    id: 'b_add', subject: 'math', grade: 2, strand: 'add_sub',
    title: 'חיבור עד 100 בלי המרה', short: 'חיבור',
    prerequisites: ['b_place'], tierDifficulty: [-1.5, -0.9, -0.3], curriculumVersion: 'new-2023',
  },
  {
    id: 'b_sub', subject: 'math', grade: 2, strand: 'add_sub',
    title: 'חיסור עד 100 בלי המרה', short: 'חיסור',
    prerequisites: ['b_place'], tierDifficulty: [-1.3, -0.7, -0.1], curriculumVersion: 'new-2023',
  },
  {
    id: 'b_add_carry', subject: 'math', grade: 2, strand: 'add_sub',
    title: 'חיבור עם המרה (מעבר עשרת)', short: 'חיבור עם המרה',
    prerequisites: ['b_add'], tierDifficulty: [-0.6, 0.1, 0.7], curriculumVersion: 'new-2023',
  },
  {
    id: 'b_sub_borrow', subject: 'math', grade: 2, strand: 'add_sub',
    title: 'חיסור עם המרה (פריטת עשרת)', short: 'חיסור עם פריטה',
    prerequisites: ['b_sub'], tierDifficulty: [-0.3, 0.4, 1.0], curriculumVersion: 'new-2023',
  },
  {
    id: 'b_missing', subject: 'math', grade: 2, strand: 'add_sub',
    title: 'השלמה ומספר חסר', short: 'מספר חסר',
    prerequisites: ['b_add', 'b_sub'], tierDifficulty: [-0.8, 0.0, 0.8], curriculumVersion: 'new-2023',
  },
  {
    id: 'b_mult_intro', subject: 'math', grade: 2, strand: 'mult_div',
    title: 'כפל כחיבור חוזר (2, 5, 10)', short: 'מתחילים כפל',
    prerequisites: ['b_add'], tierDifficulty: [-1.0, -0.3, 0.4], curriculumVersion: 'new-2023',
  },
  {
    id: 'g_mult_easy', subject: 'math', grade: 3, strand: 'mult_div',
    title: 'לוח הכפל: 1, 2, 5, 10', short: 'כפל קל',
    prerequisites: ['b_mult_intro'], tierDifficulty: [-0.9, -0.4, 0.1], curriculumVersion: '2006',
  },
  {
    id: 'g_mult_mid', subject: 'math', grade: 3, strand: 'mult_div',
    title: 'לוח הכפל: 3, 4, 6', short: 'כפל בינוני',
    prerequisites: ['g_mult_easy'], tierDifficulty: [-0.2, 0.3, 0.8], curriculumVersion: '2006',
  },
  {
    id: 'g_mult_hard', subject: 'math', grade: 3, strand: 'mult_div',
    title: 'לוח הכפל: 7, 8, 9', short: 'כפל מאתגר',
    prerequisites: ['g_mult_mid'], tierDifficulty: [0.4, 0.9, 1.4], curriculumVersion: '2006',
  },
  {
    id: 'g_div', subject: 'math', grade: 3, strand: 'mult_div',
    title: 'חילוק כהפוך של כפל', short: 'חילוק',
    prerequisites: ['g_mult_easy'], tierDifficulty: [-0.1, 0.5, 1.1], curriculumVersion: '2006',
  },
  {
    id: 'g_div_rem', subject: 'math', grade: 3, strand: 'mult_div',
    title: 'חילוק עם שארית', short: 'חילוק עם שארית',
    prerequisites: ['g_div'], tierDifficulty: [0.6, 1.1, 1.6], curriculumVersion: '2006',
  },
  {
    id: 'g_word', subject: 'math', grade: 3, strand: 'word',
    title: 'בעיות מילוליות בכפל ובחילוק', short: 'בעיות סיפור',
    prerequisites: ['g_mult_mid', 'g_div'], tierDifficulty: [0.3, 0.9, 1.5], curriculumVersion: '2006',
  },
];

import { LANGUAGE_NODES } from './content/language';
import { SCIENCE_NODES } from './content/science';

export const NODES: CurriculumNode[] = [...MATH_NODES, ...LANGUAGE_NODES, ...SCIENCE_NODES];

export const NODE_BY_ID: Record<string, CurriculumNode> = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const STRATEGIES: Record<StrategyId, { name: string; icon: string; tip: string }> = {
  decompose: { name: 'לפרק לחלקים', icon: '🧩', tip: 'מפרקים מספר לעשרות ויחידות, או בעיה לצעדים קטנים' },
  check_inverse: { name: 'לבדוק בדרך ההפוכה', icon: '🔄', tip: 'בודקים חיבור בעזרת חיסור, וכפל בעזרת חילוק' },
  pattern: { name: 'לחפש תבנית', icon: '🔍', tip: 'שמים לב למה שחוזר: קפיצות של 5, של 10, ספרה אחרונה' },
  estimate: { name: 'להעריך קודם', icon: '🎯', tip: 'לפני שמחשבים שואלים: בערך כמה זה יוצא?' },
  known_fact: { name: 'להשתמש במה שאני יודע', icon: '💡', tip: 'אם 5×7=35 אז 6×7 זה עוד 7' },
  draw: { name: 'לצייר את הבעיה', icon: '✏️', tip: 'מציירים קבוצות, קווים או עיגולים כדי לראות את הבעיה' },
  eliminate: { name: 'לפסול תשובות', icon: '❌', tip: 'מוחקים קודם את מה שבטוח לא נכון, ובוחרים מבין מה שנשאר' },
  look_back: { name: 'לחזור לטקסט', icon: '📖', tip: 'מחפשים בטקסט את המשפט שמוכיח את התשובה' },
  think_ahead: { name: 'לחשוב צעד קדימה', icon: '🔮', tip: 'לפני שמשחקים שואלים: מה היריב יעשה אחרי המהלך שלי?' },
  spot_threat: { name: 'לזהות איום', icon: '🛡️', tip: 'בודקים אם ליריב יש שורה שכמעט נסגרת, וחוסמים אותה' },
  work_backwards: { name: 'לעבוד מהסוף להתחלה', icon: '⏪', tip: 'מתחילים מהמטרה ושואלים: מה צריך לקרות רגע לפני?' },
};

/** Feedback for the child (kid) and the insight shown to the parent. */
export const MISTAKES: Record<MistakeType, { kid: string; parent: string }> = {
  forgot_carry: {
    kid: 'כמעט! נראה שהעשרת שנוצרה מהיחידות נשכחה בדרך.',
    parent: 'שוכח להעביר עשרת בחיבור עם המרה',
  },
  digit_concat: {
    kid: 'חיברת כל ספרה לבד והדבקת. כשהיחידות עוברות 9 - מעבירים עשרת.',
    parent: 'מחבר ספרות בנפרד בלי להבין מבנה עשרוני',
  },
  smaller_from_larger: {
    kid: 'שי{ם|מי} לב: ביחידות צריך להוריד מהמספר העליון, גם כשהוא קטן יותר. בשביל זה פורטים עשרת.',
    parent: 'מחסר "קטן מגדול" בכל ספרה במקום לפרוט עשרת',
  },
  forgot_borrow: {
    kid: 'כמעט! פרטת עשרת, אבל לא הורדת אותה מהעשרות.',
    parent: 'פורט עשרת אבל לא מעדכן את ספרת העשרות',
  },
  off_by_one: {
    kid: 'ממש קרוב, הפרש של 1. כדאי לבדוק שוב את הספירה.',
    parent: 'טעויות ספירה קטנות (הפרש 1)',
  },
  off_by_ten: {
    kid: 'קרוב, הפרש של 10. בד{וק|קי} שוב את ספרת העשרות.',
    parent: 'טעות בספרת העשרות',
  },
  wrong_operation: {
    kid: 'נראה שהשתמשת בפעולה אחרת. קר{א|אי} שוב את הסימן: + − × או :',
    parent: 'מתבלבל בין פעולות חשבון',
  },
  skip_count_slip: {
    kid: 'כמעט! בספירה בקפיצות קפצת צעד אחד יותר מדי או פחות מדי.',
    parent: 'סופר בקפיצות ומפספס צעד בלוח הכפל',
  },
  swapped_digits: {
    kid: 'הספרות התהפכו! העשרות משמאל והיחידות מימין.',
    parent: 'מחליף בין ספרת העשרות לספרת היחידות',
  },
  remainder_too_big: {
    kid: 'השארית תמיד קטנה מהמספר שמחלקים בו. אפשר להכניס עוד קבוצה אחת.',
    parent: 'משאיר שארית גדולה מהמחלק',
  },
  misconception: {
    kid: 'זו טעות שהרבה ילדים עושים. בו{א|אי} נבין למה.',
    parent: 'תפיסה שגויה נפוצה',
  },
  other: {
    kid: 'לא נורא, טעויות הן חלק מהלמידה. בו{א|אי} נראה ביחד איך פותרים.',
    parent: 'טעות אחרת',
  },
};
