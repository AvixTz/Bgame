# "חכמים יותר" - smart words

One JSON array per domain: `src/content/smarter/<domain>.json`. Validate: `node scripts/smarter/validate.mjs`.
Domains are listed in `src/content/smarter/domains.json` (id, name, icon).

```json
{
  "id": "economy-investment",
  "word": "השקעה",
  "domain": "economy",
  "meaning": "לתת משהו עכשיו כדי לקבל יותר בעתיד",
  "explain": "השקעה היא כשנותנים משהו עכשיו - כסף, זמן או מאמץ - כדי שבעתיד יהיה לנו יותר. כמו לשתול זרע: היום הוא קטן, ואחרי זמן הוא עץ שנותן פירות.",
  "picture": { "emoji": "🪙 ➜ 🌱 ➜ 🌳", "caption": "מטבע היום, עץ מחר" },
  "story": {
    "title": "העציץ של מיכל",
    "text": "מיכל קיבלה עשרה שקלים ליום ההולדת. ... היא הבינה שזו [[השקעה]]: היא נתנה משהו קטן היום וקיבלה משהו גדול יותר אחר כך."
  },
  "questions": [
    { "q": "מה זו השקעה?", "options": ["לתת משהו עכשיו כדי לקבל יותר אחר כך", "לבזבז את כל הכסף מהר", "לשכוח משהו בבית"], "answer": 0, "why": "השקעה היא ויתור קטן היום בשביל תועלת גדולה יותר בעתיד." }
  ],
  "realLife": "מתי השקעת זמן או מאמץ במשהו, וזה השתלם לך אחר כך?",
  "related": ["חיסכון", "תשואה"],
  "source": "sheet"
}
```

Rules
- `meaning` up to 80 characters, plain words a 7-9 year old knows. Never define a word with itself.
- `explain` 2-3 short sentences (up to 320 characters) with a concrete image from a child's life.
- `picture.emoji` 2-5 emoji that illustrate the idea (a tiny scene or a before/after), caption up to 40 chars.
- `story.text` 3-6 sentences (up to 650 characters), named characters, a situation from a child's life that
  shows the meaning (not just mentions it). The word (in any form) is marked `[[like this]]` at least once.
- 3-5 questions, 2-4 options each, `answer` is the index of the right option, `why` explains in one sentence.
  Easy and concrete: what does it mean, which child is doing X, which sentence uses the word correctly,
  what is the opposite. Wrong options are plausible for a child but clearly wrong once the word is understood.
  The app shuffles options, so order does not matter.
- `realLife` addresses the child and may use gender markers `{m|f}` (e.g. `השתמש{|ת}`). Everything else is
  third person without markers.
- `related` (optional): up to 4 other words from the bank that connect to this one.
- No long dashes. Israeli everyday settings, diverse names.
