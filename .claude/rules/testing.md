---
paths:
  - "src/brain/**"
  - "src/minigames/**/engines.ts"
  - "src/economy/**"
---
# Testing

- Every generator must produce a correct answer for every tier over hundreds of seeds
  (see `brain.test.ts`, "every node and tier yields a correct..."). New nodes are covered automatically;
  add a targeted test for any rule the generator promises (e.g. "no carry", "remainder < divisor").
- Learner-model changes need a test that shows the behavior (mastery, unlock, review, recommendation).
- Game engines: test AI strength by simulation against a random player, and add a regression test
  for every bug fixed.
- Run `npm run typecheck && npm test`. For UI changes also run the `playtest` skill.
