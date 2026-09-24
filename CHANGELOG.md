# Changelog

Versions follow `MAJOR.MINOR.PATCH`. Each release is a git tag (`v0.2.0`) with a GitHub release.

## v0.3.0 - 2026-09-24 - "Clay Island" design
- New design system (`src/theme/tokens.css`): claymorphism for kids, Fredoka + Rubik (both with
  Hebrew), island palette, soft double shadows, chunky pressable buttons, spring motion tokens.
- Lucide SVG icons replace emoji in every control; emoji stay only as content.
- 3D island rebuilt: rolling terrain the avatar walks on, animated sea with foam, stone paths,
  instanced trees/bushes/rocks/flowers, clouds, butterflies, and a landmark per world (mine with
  crystals and a gold cart, tower of giant books, lab dome with bubbling flask, village houses and
  well, chess arena). Entry pads glow with a light beam when the child steps on them.
- New avatar with swinging arms and legs, blinking eyes, backpack; footstep dust; camera look-ahead,
  steeper camera in portrait so trees do not hide the avatar.
- Portal wipe transition, confetti on correct answers, mastery and wins, medal + 3-star summary,
  animated coin counter.
- Frame-rate independent braking; playtest waits by rendered frames and passes with zero drift.

## v0.2.0 - 2026-09-24
- Four new worlds: Library of Words (Hebrew), Nature Lab (science), Thinking Arena
  (tic-tac-toe, connect four, Towers of Hanoi), Friends Village (values and friendship).
- Joystick drift fixed; `npm run playtest` measures drift and fails if it returns.
- Hebrew gender helper fixes final letters; content reviewed for pedagogy and language.
- Claude Code project structure: CLAUDE.md, AGENTS.md, .mcp.json, `.claude/` rules, skills, agents, hooks.
- CI on GitHub Actions: typecheck, unit tests, build.

## v0.1.0 - 2026-09-24
- First playable slice: 3D island, Mines of Numbers for grades ב-ג, placement journey,
  learner model (Elo, mastery, spaced review), coins, weekly goal, avatar shop, parent report.
