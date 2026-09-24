#!/usr/bin/env node
/**
 * Validates bedtime-story content: src/content/story/<storyId>/story.json + chapters/NN.json.
 * Run: node scripts/story/validate.mjs   (exit 1 on any error). Format: docs/STORY.md.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const STORY_DIR = join(here, '../../src/content/story');
const HEB = /[֐-׿]/;
const SKILLS = ['include', 'breathe', 'help', 'no', 'truth', 'online', 'empathy', 'solve', 'respect', 'safety', 'responsibility', 'giving'];

export function validateChapter(c, at) {
  const e = [];
  if (!Number.isInteger(c.number) || c.number < 1) e.push(`${at}: number must be a positive integer`);
  if (typeof c.title !== 'string' || !HEB.test(c.title) || c.title.length > 80) e.push(`${at}: title missing or over 80 chars`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.publishDate ?? '') || Number.isNaN(Date.parse(c.publishDate))) e.push(`${at}: publishDate must be YYYY-MM-DD`);
  if (!Array.isArray(c.paragraphs) || !c.paragraphs.length) e.push(`${at}: paragraphs must be a non-empty array`);
  else c.paragraphs.forEach((p, i) => { if (typeof p !== 'string' || !p.trim()) e.push(`${at}: paragraph ${i + 1} is empty`); else if (p.length > 700) e.push(`${at}: paragraph ${i + 1} is ${p.length} chars (max 700, split it for read-aloud)`); });
  const l = c.learning;
  if (l !== undefined) {
    if (typeof l.issue !== 'string') e.push(`${at}: learning.issue must be a string`);
    if (l.skill !== undefined && !SKILLS.includes(l.skill)) e.push(`${at}: learning.skill "${l.skill}" is not one of ${SKILLS.join(', ')}`);
    for (const [i, q] of (l.questions ?? []).entries()) {
      if (typeof q.question !== 'string' || !q.question.trim()) e.push(`${at}: question ${i + 1} has no text`);
      if (q.options !== undefined) {
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) e.push(`${at}: question ${i + 1} needs 2-4 options`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) e.push(`${at}: question ${i + 1} answer must be the index of the right option`);
      }
    }
  }
  return e;
}

export function loadStories() {
  const out = [];
  for (const id of readdirSync(STORY_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const dir = join(STORY_DIR, id);
    const meta = existsSync(join(dir, 'story.json')) ? JSON.parse(readFileSync(join(dir, 'story.json'), 'utf8')) : null;
    const chDir = join(dir, 'chapters');
    const chapters = existsSync(chDir) ? readdirSync(chDir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: join(chDir, f), name: f, data: JSON.parse(readFileSync(join(chDir, f), 'utf8')) })) : [];
    out.push({ id, dir, meta, chapters });
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const errors = [];
  let count = 0;
  let stories;
  try { stories = loadStories(); } catch (err) { console.error(`invalid JSON: ${err.message}`); process.exit(1); }
  for (const s of stories) {
    if (!s.meta) errors.push(`${s.id}: missing story.json`);
    else if (s.meta.id !== s.id) errors.push(`${s.id}/story.json: id must equal the folder name`);
    const nums = new Set();
    for (const c of s.chapters) {
      const at = `${s.id}/chapters/${c.name}`;
      errors.push(...validateChapter(c.data, at));
      if (Number(c.name.replace('.json', '')) !== c.data.number) errors.push(`${at}: file name must match "number" (e.g. 03.json)`);
      if (nums.has(c.data.number)) errors.push(`${at}: duplicate chapter number`);
      nums.add(c.data.number);
      count++;
    }
  }
  if (errors.length) console.error(errors.join('\n'));
  console.log(`stories: ${stories.length}, chapters: ${count}`);
  process.exit(errors.length ? 1 : 0);
}
