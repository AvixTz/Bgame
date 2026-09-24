#!/usr/bin/env node
/**
 * Imports chapters written as plain text into the bedtime-story format.
 *
 *   node scripts/story/import.mjs chapters.md --story shira-and-the-moon --title "שירה והירח" [--start 2026-10-01]
 *
 * Input format (a .md or .txt file, e.g. exported from Google Docs / Word as plain text):
 *
 *   # פרק 1: הכוכב שלא רצה לישון
 *   תאריך: 2026-10-01                (optional)
 *   נושא: ויסות לפני שינה            (optional - otherwise run extract-issue.mjs)
 *
 *   paragraph...
 *
 *   paragraph...
 *
 *   # פרק 2: ...
 *
 * Paragraphs are separated by a blank line. Chapters without a date get one chapter a day,
 * starting the day after the story's last scheduled chapter (or --start, or tomorrow).
 * Existing chapter files with the same number are replaced; others are kept.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STORY_DIR, validateChapter } from './validate.mjs';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const file = process.argv[2];
const storyId = arg('story');
if (!file || !storyId || !/^[a-z0-9-]+$/.test(storyId)) {
  console.error('usage: node scripts/story/import.mjs <file> --story <id-in-english-letters> [--title "שם"] [--start YYYY-MM-DD]');
  process.exit(1);
}
const dir = join(STORY_DIR, storyId);
const chDir = join(dir, 'chapters');
mkdirSync(chDir, { recursive: true });
if (!existsSync(join(dir, 'story.json'))) {
  writeFileSync(join(dir, 'story.json'), JSON.stringify({ id: storyId, title: arg('title') ?? storyId, color: '#5B5BD6' }, null, 2) + '\n');
} else if (arg('title')) {
  const meta = JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8'));
  writeFileSync(join(dir, 'story.json'), JSON.stringify({ ...meta, title: arg('title') }, null, 2) + '\n');
}

const day = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return day(d); };
const existing = readdirSync(chDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(chDir, f), 'utf8')));
let next = arg('start') ?? (existing.length ? addDays(existing.map((c) => c.publishDate).sort().at(-1), 1) : addDays(day(new Date()), 1));

const text = readFileSync(file, 'utf8').replace(/\r/g, '');
const blocks = text.split(/^#+\s*/m).map((b) => b.trim()).filter(Boolean);
let errors = 0;
for (const block of blocks) {
  const [head, ...rest] = block.split('\n');
  const m = head.match(/פרק\s*(\d+)\s*[:.\-–]?\s*(.*)/);
  if (!m) { console.warn(`skipped a section that does not start with "פרק N": ${head.slice(0, 40)}`); continue; }
  const number = Number(m[1]);
  let body = rest.join('\n');
  const date = body.match(/^תאריך:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1];
  const issue = body.match(/^נושא:\s*(.+)$/m)?.[1]?.trim();
  body = body.replace(/^(תאריך|נושא):.*$/gm, '');
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  const publishDate = date ?? next;
  if (!date) next = addDays(next, 1);
  const prev = existing.find((c) => c.number === number);
  const chapter = { number, title: m[2].trim() || `פרק ${number}`, publishDate, paragraphs, ...(issue ? { learning: { ...(prev?.learning ?? {}), issue } } : prev?.learning ? { learning: prev.learning } : {}) };
  const errs = validateChapter(chapter, `פרק ${number}`);
  if (errs.length) { errors++; console.error(errs.join('\n')); continue; }
  writeFileSync(join(chDir, `${String(number).padStart(2, '0')}.json`), JSON.stringify(chapter, null, 2) + '\n');
  console.log(`פרק ${number}: ${chapter.title} · ${paragraphs.length} פסקאות · נפתח ב-${publishDate}`);
}
process.exit(errors ? 1 : 0);
