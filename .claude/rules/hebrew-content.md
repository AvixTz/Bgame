---
paths:
  - "src/brain/content/**"
  - "src/minigames/**"
  - "src/ui/**"
---
# Hebrew content

- Text addressed to the child uses `{m|f}` markers and is rendered with `g(text, gender)`:
  `'בד{וק|קי} שוב'`. Past-tense 2nd person (e.g. "פתרת") is identical and needs no marker.
- Grade ב-ג reading level: short sentences, everyday words, no nested clauses.
- Math expressions and numbers render inside an LTR-isolated element (`.q-expr`), never inline RTL.
- Division uses `:` (Israeli school convention), subtraction uses `−`.
- Praise the process ("בדקת כל שורה"), never the person ("אתה גאון") - Mueller & Dweck 1998.
- A wrong answer gets information, not judgment. Common misconceptions get a `choiceFeedback` text.
