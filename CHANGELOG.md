# Changelog

Versions follow `MAJOR.MINOR.PATCH`. Each release is a git tag (`v0.2.0`) with a GitHub release.

## Unreleased - deployment and data server
- Data server (server/): children sign in with name + school + 4-digit code; progress is saved on
  the server. No route takes a player id, so a child can only reach their own data (14 isolation
  tests + a browser end-to-end test). Runs in a sealed container: no network, read-only, own uid,
  resource limits, reached by nginx through a unix socket only. Nightly backups, admin CLI (reset
  code, delete, export), self-service delete in the parents' area. No npm dependencies.
- Production deployment kit: nginx site with security headers and CSP, one-time server setup script,
  atomic release deploy over SSH with rollback, GitHub Actions deploy workflow, docs/DEPLOY.md.
- Fonts are self-hosted (@fontsource, Hebrew + Latin subsets): no request to Google on each visit.

## v0.6.0 - 2026-09-24 - "חכמים יותר"
- New house at the front of the island (a school with a glowing light bulb): 105 richer words in 13
  domains, built from the "100 words" sheet (duplicates merged, a few meanings and examples fixed).
- Each word: meaning, emoji illustration, short explanation, a mini story that shows the meaning with
  the word highlighted (read aloud), related words, and 3-5 easy questions with shuffled options.
- Status per word: טרם נלמד → הוצג (first two days) → בתרגול (questions passed on two different days)
  → מכירים (from day 3, after the child marks real-life use, with an optional note or voice recording
  kept only on the device). "Waiting for you today" list; parents see statuses, notes and recordings.
- `npm run smarter:generate -- words.csv`: new sheet rows become full word content via the Claude API.

## v0.5.0 - 2026-09-24 - puzzle garden
- New portal "גן החידות" with a toy-block tower landmark.
- Word search by category (11 categories: animals, countries, jobs, names, holidays, fruit and
  vegetables, school, transport, body, colors, the sea) or a surprise. Levels by fixed rules:
  8x8 two directions, 10x10 with diagonals, 12x12 all directions with decoy letters and no hints.
  Every word appears exactly once (tested). Drag or tap-tap to select.
- Exercise search: a board of numbers and signs; find the correct exercises left-to-right or
  top-to-bottom. Wrong-looking-right exercises from level 2; level 3 adds multiplication. A wrong
  pick shows the right result, no penalty.
- `npm run story:import`: turns chapters written as plain text into story files, one per night.

## v0.4.0 - 2026-09-24 - levels, situation questions, bedtime story
- Arena: levels 1-3 chosen by the child. The computer follows fixed rules shown on screen (no
  randomness): level 3 never loses tic-tac-toe, searches 7 moves ahead in connect four, and Hanoi
  level 3 has 5 disks with no hints. Won levels get a trophy; the game suggests, never forces.
- Math + reading: numbers in words (both directions), exercises written in words, and word problems
  with gendered names and correct Hebrew number agreement (`hebrewNumbers.ts`).
- Values: a bank of 756 situation questions across 12 skills, reviewed for Hebrew and ambiguity.
  Rounds of 8 mix skills, prefer unseen items and bring back misunderstood ones after 3 days. The
  options are reshuffled on every showing (tested for a uniform position of the good answer).
  Parents see the share understood on the first choice per skill.
- Automatic growth: `scripts/values/generate.mjs` (Claude API, structured output, validation) and a
  weekly workflow that opens a PR for review.
- Bedtime story: a new portal with a night tent landmark, one chapter a night by publish date,
  read-aloud with paragraph highlighting, text size control, good-night question, parent note.
  Chapter format and tooling in `docs/STORY.md`; `scripts/story/extract-issue.mjs` suggests each
  chapter's learning issue.
- Responsive: new audit at 6 screen sizes (phones portrait and landscape, tablet, laptop, desktop)
  with an overflow check; fixes for narrow phones and short landscape screens.

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
