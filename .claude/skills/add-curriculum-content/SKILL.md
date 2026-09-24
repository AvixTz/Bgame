---
name: add-curriculum-content
description: Add or extend curriculum topics (nodes), exercise generators or question banks in Bgame for math, Hebrew language, science or values. Use when asked to add topics, questions, exercises, grades or subjects.
---
# Add curriculum content

1. Find the source: the MoE document for the subject and grade (links in `docs/PLAN.md` §5). Write the
   node's grade honestly; if the ministry only gives checkpoints (Hebrew: end of ב/ד/ו), say so.
2. Add a `CurriculumNode` (id prefix: `b_`/`g_` math, `l_` language, `s_` science) with
   `prerequisites` and three `tierDifficulty` values on the shared logit scale.
3. Add a generator returning a `Draft`:
   - numeric answers → like the math generators in `src/brain/generators.ts`;
   - multiple choice → `choiceDraft()` or `bankGenerator()` from `src/brain/content/helpers.ts`.
   Every item needs 3 hints (strategy name → pointer → worked answer), an `explain`, and strategy tags.
   Put a `choiceFeedback` text on distractors that reflect a known misconception.
4. Hebrew: gender markers for text addressed to the child; kid-level wording (rules/hebrew-content.md).
5. Run `npm test` - the generator test sweeps every node × tier × 300 seeds automatically.
6. Ask the `pedagogy-reviewer` and `hebrew-copy-editor` agents to review the diff before committing.
