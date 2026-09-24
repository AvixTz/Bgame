#!/usr/bin/env node
/**
 * Grows the values/SEL question bank with the Claude API.
 *
 *   ANTHROPIC_API_KEY=... node scripts/values/generate.mjs [--skill truth] [--count 12] [--dry-run]
 *
 * For each skill (or the one given) it asks Claude for `count` new situations, sends the existing
 * situations so it avoids repeats, validates every item with validate.mjs, drops what fails, and
 * writes src/content/values/<skill>-gen-YYYYMMDD.json. The app picks new files up automatically.
 * A human reviews the result in the pull request the workflow opens - nothing ships unreviewed.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { SKILLS, validateItems } from './validate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../../src/content/values');

const SKILL_BRIEF = {
  include: 'לצרף ילדים שנשארו בחוץ, לא להחרים, לשים לב למי שלבד',
  breathe: 'ויסות רגשי: כעס, תסכול, פחד, לנשום ולהירגע לפני שמגיבים',
  help: 'לבקש עזרה ולהציע עזרה, לדעת למי לפנות',
  no: 'להגיד "לא" בנימוס ובביטחון, לעמוד בלחץ חברתי',
  truth: 'אמירת אמת, להודות בטעות, לא להאשים אחרים',
  online: 'התנהגות בטוחה ומכבדת ברשת, בקבוצות ובמשחקים מקוונים',
  empathy: 'להבין מה אחרים מרגישים, להקשיב, לנחם',
  solve: 'פתרון מחלוקות: תורות, פשרה, הצעת רעיונות',
  respect: 'כבוד לשונה, להורים, למורים, לחפצים ולסביבה',
  safety: 'בטיחות: רחוב, מים, זרים, גוף שלי (מרחב אישי ולספר למבוגר שסומכים עליו)',
  responsibility: 'לקחת אחריות על משימות, חפצים, בעלי חיים והבטחות',
  giving: 'נתינה, שיתוף, התנדבות והכרת תודה',
};

const OptionSchema = z.object({
  text: z.string().describe('פעולה בשם הפועל, למשל "לשאול אם הוא רוצה להצטרף"'),
  quality: z.enum(['best', 'ok', 'poor']),
  feedback: z.string().describe('מה קורה ואיך מרגישים, משפט או שניים'),
});
const ItemSchema = z.object({
  situation: z.string(),
  question: z.string(),
  options: z.array(OptionSchema),
  home: z.string().describe('שאלה קצרה לשיחה עם ההורים בבית'),
});
const BatchSchema = z.object({ items: z.array(ItemSchema) });

function loadBank() {
  const all = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    all.push(...JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  return all;
}

function systemPrompt(bank) {
  const schema = readFileSync(join(dir, 'SCHEMA.md'), 'utf8');
  // Stable examples (first item of each skill) so the cached prefix does not change between runs.
  const examples = SKILLS.map((s) => bank.find((i) => i.skill === s)).filter(Boolean).slice(0, 4);
  return `את/ה כותב/ת תוכן חינוכי לילדים בכיתות ב-ג בישראל: שאלות מצב בנושא ערכים, חברות ומוסר.
הילד קורא סיטואציה, בוחר מה כדאי לעשות, ומקבל משוב שמסביר מה קורה ואיך אנשים מרגישים.
המטרה: שהילד יבין את הסיטואציה ולא ינחש. לכן:
- התשובה הטובה ביותר לא תהיה הארוכה ביותר או המנומסת ביותר באופן שיטתי. אורכי האפשרויות דומים.
- לפחות אפשרות אחת "ok" שנשמעת סבירה אבל חסר בה משהו שרק מי שהבין את המצב יזהה.
- מסיחים אמינים, כאלה שילד באמת היה עושה. בלי אפשרויות מגוחכות.
- עברית תקינה בגובה עיניים של ילד בן 7-9, משפטים קצרים, ניקוד לא נדרש.
- גוף שלישי עם דמות בשם (שמות ישראליים מגוונים: יהודים, ערבים, דרוזים, עולים). אפשרויות בשם הפועל.
- בלי סימוני מגדר כמו {ה|ת}. בלי מקפים ארוכים.
- מצבים מחיי היומיום: כיתה, הפסקה, בית, משפחה, חוג, שכונה, טיול, מסך.
- בטיחות: רק מרחב אישי, "לא" למגע לא רצוי ולספר למבוגר שסומכים עליו. בלי תוכן מפחיד או גרפי.
- משוב בלי הטפה: תוצאה ורגש, לא "צריך" ו"אסור".
- מגבלות אורך: situation 20-260 תווים, question 8-80, text של אפשרות 4-110, feedback 10-240.
- 3-4 אפשרויות, בדיוק אחת best, לפחות אחת poor.

${schema}

דוגמאות מהמאגר:
${JSON.stringify(examples, null, 1)}`;
}

function userPrompt(skill, count, bank) {
  const existing = bank.filter((i) => i.skill === skill).map((i) => `- ${i.situation}`);
  return `כתוב/כתבי ${count} שאלות מצב חדשות למיומנות "${skill}" (${SKILL_BRIEF[skill]}).
כל שאלה בסיטואציה שונה מהקיימות ושונה זו מזו. גוון מקומות, דמויות וסוג הדילמה.
הסיטואציות שכבר קיימות במאגר (אל תחזור/תחזרי עליהן ועל וריאציות קרובות):
${existing.join('\n') || '(אין עדיין)'}`;
}

function nextId(skill, bank) {
  const nums = bank.filter((i) => i.skill === skill).map((i) => Number(i.id.split('-')[1]) || 0);
  return Math.max(0, ...nums) + 1;
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

async function generateSkill(client, skill, count, bank) {
  const msg = await client.beta.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    cache_control: { type: 'ephemeral' },
    system: systemPrompt(bank),
    messages: [{ role: 'user', content: userPrompt(skill, count, bank) }],
    output_config: { format: betaZodOutputFormat(BatchSchema) },
  });
  if (msg.stop_reason === 'refusal') {
    console.warn(`${skill}: request declined, skipping`);
    return [];
  }
  if (msg.stop_reason === 'max_tokens') console.warn(`${skill}: hit max_tokens, output may be partial`);
  const raw = msg.parsed_output?.items ?? [];
  const seen = new Set(bank.map((i) => norm(i.situation)));
  let n = nextId(skill, bank);
  const kept = [];
  for (const it of raw) {
    const item = { id: `${skill}-${String(n).padStart(3, '0')}`, skill, ...it };
    const errs = validateItems([item], skill);
    if (errs.length) { console.warn(`${skill}: dropped item - ${errs[0]}`); continue; }
    if (seen.has(norm(item.situation))) { console.warn(`${skill}: dropped duplicate situation`); continue; }
    seen.add(norm(item.situation));
    kept.push(item);
    n++;
  }
  const batchErrs = validateItems(kept, skill);
  if (batchErrs.length) console.warn(`${skill}: batch warnings\n${batchErrs.join('\n')}`);
  const u = msg.usage;
  console.log(`${skill}: kept ${kept.length}/${raw.length} (model ${msg.model}, in ${u.input_tokens}, cache read ${u.cache_read_input_tokens ?? 0}, out ${u.output_tokens})`);
  return kept;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const skillArg = arg('skill');
  const count = Number(arg('count', '12'));
  const dry = process.argv.includes('--dry-run');
  const skills = skillArg ? [skillArg] : SKILLS;
  for (const s of skills) if (!SKILLS.includes(s)) throw new Error(`unknown skill ${s}`);

  const client = new Anthropic();
  const bank = loadBank();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  let total = 0;
  for (const skill of skills) {
    let items;
    try {
      items = await generateSkill(client, skill, count, bank);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw e;
      if (e instanceof Anthropic.RateLimitError) { console.warn(`${skill}: rate limited, skipping`); continue; }
      if (e instanceof Anthropic.APIError) { console.warn(`${skill}: API error ${e.status}: ${e.message}`); continue; }
      throw e;
    }
    if (!items.length) continue;
    bank.push(...items);
    total += items.length;
    if (dry) continue;
    let file = join(dir, `${skill}-gen-${stamp}.json`);
    for (let k = 2; existsSync(file); k++) file = join(dir, `${skill}-gen-${stamp}-${k}.json`);
    writeFileSync(file, JSON.stringify(items, null, 2) + '\n');
  }
  console.log(`added ${total} items${dry ? ' (dry run, nothing written)' : ''}`);
}

main().catch((e) => {
  console.error(e instanceof Anthropic.APIError ? `API error ${e.status}: ${e.message}` : e);
  process.exit(1);
});
