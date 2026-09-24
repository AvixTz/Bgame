---
name: add-minigame
description: Add a new mini-game or world to Bgame (a new portal, a game in the arena, or a new subject world). Use when asked to add, create or plug in a game, world, portal or activity.
---
# Add a mini-game or world

1. Decide the kind:
   - **Curriculum world** (teaches a subject with questions): add nodes + generators under
     `src/brain/content/<subject>.ts` (see the `add-curriculum-content` skill), extend `Subject` in
     `src/brain/types.ts`, add a `WORLDS` entry in `src/minigames/subject/SubjectWorld.tsx`.
   - **Strategy game** (arena): write a pure engine in `src/minigames/arena/engines.ts` with tests
     (AI levels 1-3, a hint function), then a component in `Arena.tsx`. Log strategy observations with
     `useStrategyLog()` (e.g. `spot_threat` when a block was needed).
   - **Free-form world**: a new folder `src/minigames/<name>/` with a component taking `onExit`.
2. Register the portal in `src/world/portals.ts` (id, name, emoji, color, angle, open) and the screen
   in `src/core/store.ts` (`Screen`, `WorldId`) and `src/App.tsx`.
3. Rewards: use `COINS` from `src/economy/economy.ts`; reward competence only (see rules/child-safety.md).
4. Parent view: add a section to `src/ui/Parent.tsx` if the game produces something parents should see.
5. Verify: `npm run typecheck && npm test`, then the `playtest` skill on desktop and phone viewports.
