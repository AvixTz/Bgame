# Values / SEL question bank

One JSON array per skill file (`<skill>.json`, or `<skill>-<batch>.json` for generated batches).
Validate with `node scripts/values/validate.mjs`.

```json
{
  "id": "include-001",
  "skill": "include",
  "situation": "בהפסקה, מאיה רואה שיואב עומד לבד ליד הגדר ומסתכל על המשחק.",
  "question": "מה כדאי למאיה לעשות?",
  "options": [
    { "text": "לשאול את יואב אם הוא רוצה להצטרף", "quality": "best", "feedback": "יואב שמח שמישהו שם לב אליו. עכשיו יש עוד שחקן, והמשחק כיפי יותר." },
    { "text": "להמשיך לשחק כאילו לא ראתה", "quality": "poor", "feedback": "יואב נשאר לבד כל ההפסקה. אולי הוא רצה לשחק אבל התבייש לבקש." },
    { "text": "לחכות שהמורה תזמין אותו", "quality": "ok", "feedback": "המורה אולי תשים לב, אבל מאיה יכולה לעזור כבר עכשיו." }
  ],
  "home": "היה לך פעם יום שהרגשת לבד? מה עזר?"
}
```

Rules
- Skills: include, breathe, help, no, truth, online, empathy, solve, respect, safety, responsibility, giving.
- Third person with a named child character (diverse Israeli names). Options in the infinitive
  ("לשאול", "להגיד"), so the bank needs no gender markers for the reader.
- 3-4 options: exactly one `best`, at least one `poor`, optionally `ok` (reasonable but not the best).
- The app shuffles the options every time; the stored order does not matter. Do not make the best
  option systematically the longest or the most polite-sounding: understanding the situation must be
  the only way to find it.
- Feedback explains what happens and how people feel (1-2 short sentences). No lecturing.
- Grade ב-ג reading level. Safe, age-appropriate situations; body-safety items only about personal
  space, "no" to unwanted touch and telling a trusted adult.

Growing the bank automatically
- `scripts/values/generate.mjs` asks Claude for new items per skill (`--skill truth --count 12`,
  `--dry-run`), sends the existing situations so it avoids repeats, validates each item and writes
  `<skill>-gen-YYYYMMDD.json`. Ids continue from the highest existing number.
- `.github/workflows/values-generate.yml` runs it every Sunday (or on demand from the Actions tab)
  and opens a pull request. Read every item before merging. Needs the secret `ANTHROPIC_API_KEY`.
