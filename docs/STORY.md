# סיפור לילה - איך מוסיפים פרק

כל סיפור הוא תיקייה ב-`src/content/story/<storyId>/`:

```
src/content/story/
  _TEMPLATE.json          תבנית לפרק (לא נטענת למשחק)
  my-story/
    story.json            { "id": "my-story", "title": "שם הסיפור", "subtitle": "...", "color": "#5B5BD6" }
    chapters/
      01.json
      02.json
```

## פרק

```json
{
  "number": 2,
  "title": "שם הפרק",
  "publishDate": "2026-09-25",
  "paragraphs": ["פסקה", "פסקה"],
  "learning": {
    "issue": "הנושא הלימודי במשפט אחד",
    "skill": "empathy",
    "questions": [
      { "question": "שאלת הבנה", "options": ["א", "ב", "ג"], "answer": 0 },
      { "question": "שאלה פתוחה לשיחה" }
    ],
    "parentNote": "על מה כדאי לדבר אחרי הפרק"
  }
}
```

- שם הקובץ הוא מספר הפרק בשתי ספרות (`02.json`) ושווה ל-`number`.
- `publishDate` קובע מתי הפרק נפתח. אפשר לכתוב שבוע קדימה, וכל ערב נפתח פרק אחד. הפרק של הלילה הוא החדש ביותר שהילד עוד לא קרא.
- פסקאות קצרות (עד 700 תווים). כל פסקה מוקראת ומודגשת בנפרד.
- `learning` אופציונלי. בלי שאלות, הילד מקבל שאלת ברירת מחדל "מה הכי אהבת בפרק הזה?".
- `answer` הוא האינדקס של התשובה הנכונה. המשחק מערבב את סדר התשובות בכל פעם.
- `skill` הוא אחד מ: include, breathe, help, no, truth, online, empathy, solve, respect, safety, responsibility, giving.

## חילוץ האישיו הלימודי

```
ANTHROPIC_API_KEY=... node scripts/story/extract-issue.mjs --story my-story            # הצעה ב-learning.suggested
ANTHROPIC_API_KEY=... node scripts/story/extract-issue.mjs --story my-story --apply    # ממלא גם שדות ריקים ב-learning
```

הסקריפט קורא את הפרק יחד עם הנושאים של הפרקים הקודמים, ומציע נושא, מיומנות, 2 שאלות הבנה, שאלה פתוחה והערה להורה. ההצעה נשמרת ב-`learning.suggested` כדי שבן אדם יעבור עליה. `--apply` ממלא רק שדות שעוד ריקים, ולא דורס מה שכתבתם.

## בדיקה

```
node scripts/story/validate.mjs
```

ה-CI מריץ את הבדיקה בכל push. הפרק "פרק לדוגמה" בתיקייה `sample` נועד להחלפה: כשהסיפור האמיתי מוכן, מוחקים את `sample/` או משנים את `publishDate` שלו לעתיד רחוק.
