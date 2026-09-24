#!/usr/bin/env node
/**
 * Adds new "חכמים יותר" words from the planning spreadsheet with the Claude API.
 *
 *   ANTHROPIC_API_KEY=... node scripts/smarter/generate.mjs words.csv [--limit 10] [--dry-run]
 *
 * words.csv: the Google Sheet exported as CSV (File > Download > CSV). Columns used: תחום, מילה,
 * משמעות, דוגמא/דוגמה. Rows whose word already exists in the bank are skipped. The domain name is
 * matched to domains.json (unknown domains go to "worlds"). Each generated item is validated with
 * validate.mjs; failures are retried once with the errors, then skipped.
 * Output: src/content/smarter/<domain>.json (appended). Review the diff before merging.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { SMARTER_DIR, validateWords } from './validate.mjs';

const Word = z.object({
  slug: z.string().describe('english slug for the id, lowercase, e.g. investment'),
  meaning: z.string(), explain: z.string(),
  picture: z.object({ emoji: z.string(), caption: z.string() }),
  story: z.object({ title: z.string(), text: z.string() }),
  questions: z.array(z.object({ q: z.string(), options: z.array(z.string()), answer: z.number().int(), why: z.string() })),
  realLife: z.string(),
  related: z.array(z.string()),
});

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const csvFile = process.argv[2];
if (!csvFile) { console.error('usage: node scripts/smarter/generate.mjs <words.csv> [--limit N] [--dry-run]'); process.exit(1); }
const dry = process.argv.includes('--dry-run');
const limit = Number(arg('limit') ?? 20);

const domains = JSON.parse(readFileSync(join(SMARTER_DIR, 'domains.json'), 'utf8'));
const domainIds = domains.map((d) => d.id);
const fileOf = (d) => join(SMARTER_DIR, `${d}.json`);
const bank = Object.fromEntries(domainIds.map((d) => [d, existsSync(fileOf(d)) ? JSON.parse(readFileSync(fileOf(d), 'utf8')) : []]));
const allWords = () => Object.values(bank).flat();
const clean = (s) => (s ?? '').replace(/[^֐-׿\s]/g, '').trim();
const matchDomain = (name) => {
  const n = clean(name);
  return domains.find((d) => n && (d.name.includes(n) || n.includes(d.name) || n.split(/\s+/).some((w) => w.length > 2 && d.name.includes(w))))?.id ?? 'worlds';
};

const rows = parseCsv(readFileSync(csvFile, 'utf8'));
const head = rows[0].map(clean);
const col = (...names) => head.findIndex((h) => names.includes(h));
const [cDomain, cWord, cMeaning, cExample] = [col('תחום'), col('מילה', 'מילים'), col('משמעות'), col('דוגמא', 'דוגמה')];
if (cWord < 0) { console.error('no "מילה" column in the CSV'); process.exit(1); }
const known = new Set(allWords().map((w) => w.word));
const todo = rows.slice(1).map((r) => ({ domain: matchDomain(r[cDomain]), word: r[cWord]?.trim(), meaning: r[cMeaning]?.trim(), example: r[cExample]?.trim() }))
  .filter((r) => r.word && !known.has(r.word)).slice(0, limit);
console.log(`${todo.length} new words to write`);
if (!todo.length) process.exit(0);

const schema = readFileSync(join(SMARTER_DIR, 'SCHEMA.md'), 'utf8');
const example = allWords()[0];
const SYSTEM = `את/ה כותב/ת תוכן לימודי בעברית לילדים בכיתות ב-ג בישראל, לאזור "חכמים יותר" שמלמד מילים עשירות.
לכל מילה: משמעות פשוטה, הסבר קצר עם דימוי מחיי ילד, המחשה באימוג'י, מיני סיפור שבו הסיטואציה מראה את המשמעות, ו-3-5 שאלות קלות.
${schema}
${example ? `דוגמה למילה מוכנה:\n${JSON.stringify(example, null, 1)}` : ''}`;

const client = new Anthropic();
let added = 0;
for (const t of todo) {
  const existing = allWords().map((w) => w.word).join(', ');
  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await client.beta.messages.parse({
      model: 'claude-opus-5', max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      thinking: { type: 'adaptive' }, cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `מילה: ${t.word}\nתחום: ${t.domain}\nמשמעות מהטבלה: ${t.meaning ?? ''}\nדוגמה מהטבלה: ${t.example ?? ''}\nמילים שכבר במאגר (ל-related בלבד, ולהבדיל ביניהן): ${existing}${feedback}` }],
      output_config: { format: betaZodOutputFormat(Word) },
    }).catch((e) => { console.warn(`${t.word}: ${e instanceof Anthropic.APIError ? `API ${e.status}` : e.message}`); return null; });
    if (!msg || msg.stop_reason === 'refusal' || !msg.parsed_output) { console.warn(`${t.word}: no result (${msg?.stop_reason})`); break; }
    const o = msg.parsed_output;
    const item = { id: `${t.domain}-${o.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, word: t.word, domain: t.domain, meaning: o.meaning, explain: o.explain, picture: o.picture, story: o.story, questions: o.questions, realLife: o.realLife, related: o.related.filter((r) => known.has(r)).slice(0, 4), source: 'sheet' };
    const errs = validateWords([...bank[t.domain], item], domainIds, t.domain).filter((e) => e.includes(`(${t.word})`) || e.includes('duplicate'));
    if (errs.length) { feedback = `\n\nהניסיון הקודם נפסל בגלל:\n${errs.join('\n')}\nתקן/י.`; console.warn(`${t.word}: retry (${errs[0]})`); continue; }
    bank[t.domain].push(item); known.add(t.word); added++;
    console.log(`+ ${t.word} (${t.domain})`);
    break;
  }
}
if (!dry) for (const d of domainIds) if (bank[d].length) writeFileSync(fileOf(d), JSON.stringify(bank[d], null, 2) + '\n');
console.log(`added ${added} words${dry ? ' (dry run)' : ''}`);
