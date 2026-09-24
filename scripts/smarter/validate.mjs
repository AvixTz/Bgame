#!/usr/bin/env node
/** Validates the "חכמים יותר" word bank (src/content/smarter). Exit 1 on any error. Format: SCHEMA.md there. */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SMARTER_DIR = join(here, '../../src/content/smarter');
const HEB = /[֐-׿]/;
const MARK = /\{[^}]*\|[^}]*\}/;

export function validateWords(items, domains, file = '') {
  const e = [];
  const ids = new Set();
  for (const [i, w] of items.entries()) {
    const at = `${file}#${i} (${w?.word ?? '?'})`;
    if (!/^[a-z]+-[a-z0-9-]+$/.test(w.id ?? '')) e.push(`${at}: bad id`);
    if (ids.has(w.id)) e.push(`${at}: duplicate id`);
    ids.add(w.id);
    if (!domains.includes(w.domain)) e.push(`${at}: unknown domain ${w.domain}`);
    if (w.id && w.domain && !w.id.startsWith(w.domain + '-')) e.push(`${at}: id must start with the domain`);
    const str = (k, min, max, v = w[k]) => { if (typeof v !== 'string' || v.length < min || v.length > max || !HEB.test(v)) e.push(`${at}: ${k} length ${v?.length ?? 'missing'} (${min}-${max})`); };
    str('word', 2, 20); str('meaning', 6, 80); str('explain', 30, 320); str('realLife', 10, 160);
    if (typeof w.picture?.emoji !== 'string' || w.picture.emoji.length < 2 || w.picture.emoji.length > 40) e.push(`${at}: picture.emoji length`);
    str('picture.caption', 3, 40, w.picture?.caption);
    str('story.title', 3, 40, w.story?.title); str('story.text', 120, 650, w.story?.text);
    if (w.picture && /[א-ת]/.test(w.picture.emoji)) e.push(`${at}: picture.emoji should be emoji, not words`);
    if (w.story?.text && !/\[\[[^\]]+\]\]/.test(w.story.text)) e.push(`${at}: story must mark the word with [[...]]`);
    if (typeof w.meaning === 'string' && typeof w.word === 'string' && w.meaning.includes(w.word)) e.push(`${at}: meaning uses the word itself`);
    for (const s of [w.meaning, w.explain, w.story?.text, w.story?.title, ...(w.questions ?? []).flatMap((q) => [q.q, q.why, ...(q.options ?? [])])]) {
      if (typeof s === 'string' && MARK.test(s)) e.push(`${at}: gender markers only in realLife`);
      if (typeof s === 'string' && /[—–]/.test(s)) e.push(`${at}: long dash`);
    }
    const qs = w.questions;
    if (!Array.isArray(qs) || qs.length < 3 || qs.length > 5) { e.push(`${at}: needs 3-5 questions`); continue; }
    for (const [j, q] of qs.entries()) {
      const qa = `${at} q${j + 1}`;
      if (typeof q.q !== 'string' || q.q.length < 5 || q.q.length > 140) e.push(`${qa}: question text`);
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) { e.push(`${qa}: 2-4 options`); continue; }
      if (new Set(q.options).size !== q.options.length) e.push(`${qa}: duplicate options`);
      for (const o of q.options) if (typeof o !== 'string' || !o.trim() || o.length > 100) e.push(`${qa}: option length`);
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) e.push(`${qa}: answer index`);
      if (typeof q.why !== 'string' || q.why.length < 8 || q.why.length > 200) e.push(`${qa}: why length`);
    }
  }
  return e;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const domains = JSON.parse(readFileSync(join(SMARTER_DIR, 'domains.json'), 'utf8')).map((d) => d.id);
  const all = [];
  let failed = false;
  for (const f of readdirSync(SMARTER_DIR).filter((f) => f.endsWith('.json') && f !== 'domains.json')) {
    let items;
    try { items = JSON.parse(readFileSync(join(SMARTER_DIR, f), 'utf8')); } catch (err) { console.error(`${f}: ${err.message}`); failed = true; continue; }
    const errs = validateWords(items, domains, f);
    if (errs.length) { failed = true; console.error(errs.slice(0, 40).join('\n')); }
    all.push(...items);
  }
  const words = new Map();
  for (const w of all) { if (words.has(w.word)) { failed = true; console.error(`duplicate word ${w.word} (${words.get(w.word)} and ${w.id})`); } words.set(w.word, w.id); }
  const ids = new Set();
  for (const w of all) { if (ids.has(w.id)) { failed = true; console.error(`duplicate id ${w.id}`); } ids.add(w.id); }
  const byDomain = Object.fromEntries(domains.map((d) => [d, all.filter((w) => w.domain === d).length]));
  console.log(`smarter words: ${all.length}`, byDomain);
  process.exit(failed ? 1 : 0);
}
