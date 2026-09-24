#!/usr/bin/env node
/**
 * Suggests the learning issue of bedtime-story chapters with the Claude API.
 *
 *   ANTHROPIC_API_KEY=... node scripts/story/extract-issue.mjs [--story sample] [--chapter 3] [--force] [--apply]
 *
 * For each chapter without learning.suggested (or all with --force) it reads the chapter together
 * with the previous chapters' titles and issues, and writes a proposal to learning.suggested:
 * the issue, a values skill, 2 comprehension questions, 1 open talk question and a parent note.
 * With --apply it also fills learning.issue/skill/questions/parentNote where they are still empty.
 * The author reviews the proposal before it reaches children.
 */
import { writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { loadStories, validateChapter } from './validate.mjs';

const SKILLS = ['include', 'breathe', 'help', 'no', 'truth', 'online', 'empathy', 'solve', 'respect', 'safety', 'responsibility', 'giving'];

const Suggestion = z.object({
  issue: z.string().describe('הנושא הלימודי/ערכי של הפרק במשפט אחד'),
  skill: z.enum(SKILLS).describe('המיומנות הקרובה ביותר מתוך הרשימה'),
  curriculum: z.string().describe('קישור לתחום בתוכנית הלימודים לכיתות ב-ג (שפה, מדע, כישורי חיים וכו׳)'),
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).describe('3 תשובות קצרות'),
    answer: z.number().int().describe('אינדקס התשובה הנכונה, 0-2'),
  })).describe('2 שאלות הבנה שהתשובה שלהן כתובה בפרק'),
  talk: z.string().describe('שאלה פתוחה אחת לשיחה לפני השינה, מחוברת לחיי הילד'),
  parentNote: z.string().describe('משפט אחד להורה: על מה כדאי לדבר אחרי הפרק'),
});

const SYSTEM = `את/ה עורך/ת פדגוגי/ת של סיפורי לילה לילדים בכיתות ב-ג בישראל.
הסופר/ת כותב/ת פרק כל יום; התפקיד שלך הוא לחלץ את הנושא הלימודי של הפרק ולהציע שאלות.
- הנושא נובע מהפרק עצמו, לא מודבק עליו. אם הפרק הוא בעיקר הרפתקה, מצא/י את הרגע הקטן שיש בו משהו ללמוד.
- שאלות ההבנה עונות על מה שכתוב בפרק, בעברית פשוטה, 3 תשובות באורך דומה, והנכונה לא תמיד ראשונה.
- השאלה הפתוחה רכה ומרגיעה, מתאימה לפני שינה. בלי הטפה.
- פונים לילד בלשון שמתאימה לשני המגדרים או בשם הפועל.
- בלי מקפים ארוכים.`;

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const storyArg = arg('story');
  const chapterArg = arg('chapter') ? Number(arg('chapter')) : undefined;
  const force = process.argv.includes('--force');
  const apply = process.argv.includes('--apply');
  const client = new Anthropic();
  let done = 0;
  for (const s of loadStories()) {
    if (storyArg && s.id !== storyArg) continue;
    const previous = [];
    for (const c of s.chapters) {
      const ch = c.data;
      const want = (chapterArg === undefined || ch.number === chapterArg) && (force || !ch.learning?.suggested);
      if (want) {
        const context = previous.length ? `הפרקים הקודמים:\n${previous.join('\n')}\n\n` : '';
        const msg = await client.beta.messages.parse({
          model: 'claude-opus-5',
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          cache_control: { type: 'ephemeral' },
          system: SYSTEM,
          messages: [{ role: 'user', content: `${context}הסיפור: ${s.meta?.title ?? s.id}\nפרק ${ch.number}: ${ch.title}\n\n${ch.paragraphs.join('\n\n')}` }],
          output_config: { format: betaZodOutputFormat(Suggestion) },
        });
        if (msg.stop_reason === 'refusal' || !msg.parsed_output) {
          console.warn(`${s.id}/${c.name}: no suggestion (${msg.stop_reason})`);
        } else {
          const sug = msg.parsed_output;
          const learning = { ...(ch.learning ?? { issue: '' }), suggested: sug };
          if (apply) {
            if (!learning.issue) learning.issue = sug.issue;
            if (!learning.skill) learning.skill = sug.skill;
            if (!learning.questions?.length) learning.questions = [...sug.questions, { question: sug.talk }];
            if (!learning.parentNote) learning.parentNote = sug.parentNote;
          }
          const next = { ...ch, learning };
          const errs = validateChapter(next, `${s.id}/${c.name}`);
          if (errs.length) { console.warn(`suggestion rejected:\n${errs.join('\n')}`); }
          else {
            writeFileSync(c.file, JSON.stringify(next, null, 2) + '\n');
            c.data = next;
            done++;
            console.log(`${s.id}/${c.name}: ${sug.issue}`);
          }
        }
      }
      previous.push(`פרק ${ch.number}: ${ch.title}${c.data.learning?.issue ? ` (נושא: ${c.data.learning.issue})` : ''}`);
    }
  }
  console.log(`updated ${done} chapter(s)`);
}

main().catch((e) => {
  console.error(e instanceof Anthropic.APIError ? `API error ${e.status}: ${e.message}` : e);
  process.exit(1);
});
