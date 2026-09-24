---
paths:
  - "src/brain/curriculum.ts"
  - "src/brain/content/**"
---
# Curriculum content

- Each node maps to the Israeli MoE curriculum: math (new program by grade / 2006), חינוך לשוני 1-6
  (checkpoints at end of ב, ד, ו), מדע וטכנולוגיה (per-grade content specs), כישורי חיים.
  Sources are listed in `docs/PLAN.md` section 5. Set `curriculumVersion` accordingly.
- Three tiers per node, calibrated on the same logit scale (`tierDifficulty`), roughly
  -1.5 (easy grade ב) to +1.6 (hard grade ג).
- Facts must be correct and uncontroversial. When a simplification is needed for age 7-9, keep it
  true (e.g. "a car moves but does not eat, grow or reproduce").
- Distractors are plausible and tied to real misconceptions; avoid wrong options that are also
  correct in another reading.
- Every content change is reviewed by the `pedagogy-reviewer` and `hebrew-copy-editor` agents.
