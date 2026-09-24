#!/usr/bin/env node
/**
 * Validates the values/SEL question bank (src/content/values/*.json).
 * Run: node scripts/values/validate.mjs [file...]   (exit 1 on any error)
 *
 * Rules (see src/content/values/SCHEMA.md):
 * - unique ids "<skill>-NNN"; skill is one of SKILLS
 * - situation 20..260 chars, question 8..80 chars, Hebrew
 * - 3 or 4 options; exactly one "best", at least one "poor"; every option has feedback
 * - options are unique; the best option must not be systematically the longest
 * - no gender markers ({m|f}) - items are written in 3rd person with infinitive options
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILLS = ['include', 'breathe', 'help', 'no', 'truth', 'online', 'empathy', 'solve', 'respect', 'safety', 'responsibility', 'giving'];
const HEB = /[֐-׿]/;

export function validateItems(items, file = '') {
  const errors = [];
  const ids = new Set();
  const situations = new Set();
  let bestLongest = 0;
  for (const [i, it] of items.entries()) {
    const at = `${file}#${i} (${it?.id ?? 'no id'})`;
    if (!it || typeof it !== 'object') { errors.push(`${at}: not an object`); continue; }
    if (!/^[a-z]+-\d{3,}$/.test(it.id ?? '')) errors.push(`${at}: bad id`);
    if (ids.has(it.id)) errors.push(`${at}: duplicate id`);
    ids.add(it.id);
    if (!SKILLS.includes(it.skill)) errors.push(`${at}: unknown skill "${it.skill}"`);
    if (it.id && it.skill && !it.id.startsWith(it.skill + '-')) errors.push(`${at}: id must start with skill`);
    for (const [k, min, max] of [['situation', 20, 260], ['question', 8, 80]]) {
      const v = it[k];
      if (typeof v !== 'string' || v.length < min || v.length > max || !HEB.test(v)) errors.push(`${at}: ${k} missing/length ${v?.length}`);
    }
    const key = (it.situation ?? '').replace(/\s+/g, ' ').trim();
    if (situations.has(key)) errors.push(`${at}: duplicate situation`);
    situations.add(key);
    const opts = it.options;
    if (!Array.isArray(opts) || opts.length < 3 || opts.length > 4) { errors.push(`${at}: needs 3-4 options`); continue; }
    const best = opts.filter((o) => o.quality === 'best');
    if (best.length !== 1) errors.push(`${at}: exactly one best option (has ${best.length})`);
    if (!opts.some((o) => o.quality === 'poor')) errors.push(`${at}: needs at least one poor option`);
    const texts = new Set();
    for (const o of opts) {
      if (!['best', 'ok', 'poor'].includes(o.quality)) errors.push(`${at}: bad quality ${o.quality}`);
      if (typeof o.text !== 'string' || o.text.length < 4 || o.text.length > 110 || !HEB.test(o.text)) errors.push(`${at}: option text length ${o.text?.length}`);
      if (typeof o.feedback !== 'string' || o.feedback.length < 10 || o.feedback.length > 240) errors.push(`${at}: option feedback length ${o.feedback?.length}`);
      if (texts.has(o.text)) errors.push(`${at}: duplicate option`);
      texts.add(o.text);
    }
    for (const s of [it.situation, it.question, ...opts.map((o) => o.text), ...opts.map((o) => o.feedback)]) {
      if (typeof s === 'string' && /\{[^}]*\|[^}]*\}/.test(s)) errors.push(`${at}: gender markers are not allowed in the bank`);
    }
    if (best.length === 1) {
      const maxLen = Math.max(...opts.map((o) => o.text.length));
      if (best[0].text.length === maxLen) bestLongest++;
    }
  }
  const share = items.length ? bestLongest / items.length : 0;
  if (items.length >= 20 && share > 0.55) errors.push(`${file}: best option is the longest in ${(share * 100).toFixed(0)}% of items (max 55%) - children learn to pick the longest`);
  return errors;
}

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '../../src/content/values');
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => join(dir, f));
  let total = 0;
  const all = [];
  let failed = false;
  for (const f of files) {
    let items;
    try { items = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.error(`${f}: invalid JSON: ${e.message}`); failed = true; continue; }
    const errs = validateItems(items, f.split('/').pop());
    if (errs.length) { failed = true; console.error(errs.slice(0, 40).join('\n')); if (errs.length > 40) console.error(`... ${errs.length - 40} more`); }
    total += items.length;
    all.push(...items);
  }
  const globalErrs = validateItems(all, 'ALL').filter((e) => /duplicate/.test(e));
  if (globalErrs.length) { failed = true; console.error(globalErrs.slice(0, 20).join('\n')); }
  const bySkill = Object.fromEntries(SKILLS.map((s) => [s, all.filter((i) => i.skill === s).length]));
  console.log(`values bank: ${total} items`, bySkill);
  process.exit(failed ? 1 : 0);
}
