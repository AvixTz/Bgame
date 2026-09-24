# Bgame - agent guide

Bgame is a persistent learning world for Israeli grades ב-ג (ages 7-9), in Hebrew (RTL). A 3D island
in third person; each portal leads to a world that teaches one subject aligned to the Ministry of
Education curriculum, plus a strategy-games arena and a social-emotional village.
Plan and research: `docs/PLAN.md`.

## Stack
Vite + React 19 + TypeScript, three.js via @react-three/fiber and drei, zustand, Dexie (IndexedDB),
Vitest. No backend yet: everything is local-first. Deploys as a static site.

## Commands
- `npm run dev` - dev server (http://localhost:5173)
- `npm test` - unit tests (brain, content, game engines)
- `npm run typecheck` - `tsc --noEmit`
- `npm run build` - static build to `dist/`
- `node build-artifact.mjs <outDir>` - single-file HTML build (JS and CSS inlined) for sandboxed hosting

Run `npm run typecheck && npm test` before every commit.

## Map
- `src/brain/` - the learning engine. `curriculum.ts` (math nodes, strategies, mistake texts),
  `content/language.ts`, `content/science.ts` (nodes + item generators), `generators.ts` (math
  generators, mistake classifier, registry), `model.ts` (Elo, mastery, spaced review, recommender,
  placement), `insights.ts` (parent report).
- `src/minigames/subject/SubjectWorld.tsx` - one component for every curriculum world
  (mines = math, library = language, lab = science), configured by `WORLDS`.
- `src/minigames/arena/` - tic-tac-toe, connect four, Towers of Hanoi (`engines.ts` is pure and tested).
- `src/minigames/village/` - SEL scenarios (no scoring by design).
- `src/world/` - the 3D island, avatar, portals, input (`controls.ts`).
- `src/economy/` - coins, shop, collectibles, weekly goal. `src/data/db.ts` - storage.
- `src/theme/tokens.css` - all design tokens. The visual design will come from an external design
  system: change tokens, not component CSS.

## Non-negotiables
- Every child-facing Hebrew string addressed to the child uses gender markers `{m|f}` and goes
  through `g(text, gender)`. Never hard-code masculine forms.
- Content is curriculum-aligned and factually checked. New nodes cite their source document.
- No dark patterns: no timers that pressure, no loot boxes, no "you lost your streak", no rewards
  for time played, no global leaderboards of children. Coins reward competence.
- Collect no personal data beyond a nickname, gender for grammar, and grade.
- Game logic stays pure and unit-tested; React components only wire it up.
