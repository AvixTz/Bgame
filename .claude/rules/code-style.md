---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---
# Code style

- TypeScript strict. No `any`; prefer discriminated unions and `Record<Id, ...>` maps.
- Game and learning logic lives in pure modules (`src/brain`, `src/minigames/*/engines.ts`,
  `src/economy`). React components only hold UI state and call these modules.
- All randomness goes through `makeRng` from `src/core/rng.ts` so tests are reproducible.
- Player state changes go through `useApp().updatePlayer(fn)`; never mutate the player object.
- Colors, fonts, radii and shadows come from `src/theme/tokens.css`. No hex values in components.
- Comments explain why (research, a bug, a constraint), not what.
