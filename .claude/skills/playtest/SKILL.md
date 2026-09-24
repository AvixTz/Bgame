---
name: playtest
description: Play Bgame in a real headless browser to verify a change - walk the island with keyboard and joystick, enter worlds, answer questions, check the parent area, and capture desktop and phone screenshots. Use after any gameplay, UI or input change.
---
# Playtest

1. `npm run build && npx vite preview --port 4173 --strictPort &`, then `npm run playtest`
   (`tests/e2e/playtest.mjs`: fails on page errors or on avatar drift > 0.1 after input ends;
   screenshots go to `playtest-shots/`). Extend it for new worlds; the checklist below is what it covers.
2. Use Playwright (MCP server `playwright` from `.mcp.json`, or a script like the `webapp-testing`
   skill). Chromium: launch with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
3. Scenario checklist:
   - create a player (boy and girl - check Hebrew gender forms);
   - walk with arrow keys; drag the joystick (pointer down → move → up) and confirm the avatar
     STOPS after release; drag, then walk into a portal while still dragging, release, and confirm it stops;
   - teleport for speed: `window.__teleport = [x, z]` (portals are at radius 14, `src/world/portals.ts`);
   - each world: placement (math), a daily journey, a wrong answer + retry + hint, the summary;
   - arena: one game of each; village: one scenario; parent area (hold 3 s).
4. Screenshots at 1100×760 and 390×844. Look for clipped text, overlapping HUD, RTL errors.
5. Report page errors from `pageerror`/console (font loading errors behind a proxy are expected).
