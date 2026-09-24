# Bgame - אי המוח (גרסה ניסיונית)

A continuous learning and thinking world for grades ב-ג: a 3D island in third person, where every world is a subject. This first version includes one working world, **מכרות המספרים** (math, grades ב-ג), with memory, a learner model, rewards and a parents' area.

The full plan (three phases, research, curriculum map) is in [docs/PLAN.md](docs/PLAN.md).

## What works in this version

- **Third-person island** with 7 open portals, a Thinking Tree that grows with mastery, keyboard + a floating touch joystick (drift fixed and covered by an automated test).
- **⛏️ Mines of Numbers** (math): 13 topics for grades ב-ג, a placement journey, and a mistake-pattern classifier. New in v0.4: math + reading - numbers in words, exercises written in words, and short word problems (one and two steps).
- **📚 Library of Words** (language): 8 topics - gender and number agreement, singular/plural (including exceptions), punctuation, opposites, synonyms, word families, roots, and reading comprehension with short stories (explicit, sequence, inference).
- **🔬 Nature Lab** (science): 8 topics - living/non-living, states of matter, materials, animals and habitats, teeth, plants, electricity and safety, mixtures. Common misconceptions get a dedicated explanation.
- **♟️ Thinking Arena**: tic-tac-toe, connect four (the original's blocking bug fixed) and the Towers of Hanoi. Three levels the child picks (1 beginners, 2 advanced, 3 champions). The computer plays by fixed, visible rules, never randomly; level 3 plays perfect tic-tac-toe, searches 7 moves ahead in connect four, and hides the hints in Hanoi. After two wins the game suggests the next level. The game records when the child spots a threat or misses a winning move, which feeds the "spot a threat" and "think a step ahead" strategies.
- **🤝 Friends Village** (values and friendship): 8 story scenarios plus **situation questions** - a bank of 756 situations across 12 skills, drawn at random in rounds of 8. The answer order is reshuffled every time, so the only way to the good answer is to understand the situation. Weaker choices show what happens and the child tries again; situations not understood come back after 3 days. The bank grows automatically (see below).
- **🧩 Puzzle garden**: word search by category (11 categories) and an exercise search where only correct exercises count. Three rule-based levels each.
- **🌙 Bedtime story**: one chapter a night, opened by date, read aloud with the current paragraph highlighted, adjustable text size, a good-night question and a note for parents. Adding chapters: `docs/STORY.md`.
- **The brain**: Elo per topic and per thinking strategy, mastery, spaced review, a daily journey in every world, and 3-level hints.
- **Rewards**: coins for success, a weekly goal of 5 out of 7 days, an avatar shop and surprise treasures.
- **Parents' area**: strengths and gaps per subject, mistake patterns, arena levels, the social tools the child has met, and a question for the evening.
- **Claude Code project structure**: CLAUDE.md, AGENTS.md, .mcp.json, and `.claude/` with rules, skills (project skills + vendored skills), sub-agents and hooks.

## Running

```bash
cd Bgame
npm install
npm run dev        # development at http://localhost:5173
npm test           # unit tests: brain, content, game engines
npm run playtest   # full browser playtest (requires npx vite preview --port 4173)
npm run responsive # screenshots at 6 screen sizes, fails on horizontal overflow
npm run build      # static build into dist/
```

## Content pipelines

- **Situation questions**: `src/content/values/*.json` (format: `src/content/values/SCHEMA.md`). `node scripts/values/validate.mjs` checks every file. `scripts/values/generate.mjs` writes new batches with the Claude API, and the `values-generate` workflow runs it every Sunday and opens a PR for review. It needs the repository secret `ANTHROPIC_API_KEY`. New files join the game without code changes.
- **Bedtime story**: `src/content/story/<story>/chapters/NN.json`. `node scripts/story/validate.mjs` checks them; `scripts/story/extract-issue.mjs` suggests the learning issue and questions of each chapter for review.

## Moving to your own server (production)

The current build is a static site, so any web server works:

```bash
npm ci && npm run build
rsync -av dist/ user@server:/var/www/bgame/
```

nginx: `root /var/www/bgame; try_files $uri /index.html;`, plus gzip/brotli for `.js`. HTTPS is required (speech and IndexedDB are more stable over HTTPS).

The next production step, per the plan: a backend (Supabase or Postgres on your server) with a family → parent → child hierarchy, sync of `attempts` and `skills` from the device to the server, and weekly leagues. The data model is already built to allow this (`src/data/db.ts` and the docs).

## Structure

```
src/brain/       curriculum, exercise generators, learner model, parent insights (+ tests)
src/economy/     coins, shop, collectibles, weekly goal
src/data/        local storage (Dexie/IndexedDB with a memory fallback)
src/world/       the 3D island: avatar, portals, controls
src/minigames/   subject/ (mines, library, lab), arena/, village/
src/theme/       tokens.css - all design tokens (for the future design system)
.claude/         rules, skills, agents, hooks (open Claude Code in this folder)
src/ui/          profiles, HUD, shop, parents' area
```

## Known limitations

- Curriculum topics are based on Ministry of Education documents and have not yet been approved by a teacher.
- Hebrew text-to-speech depends on the device (a Hebrew voice exists on Android, iOS and Windows; not always on Linux).
- The design is temporary. It will be replaced through `src/theme/tokens.css` and the external design system.
