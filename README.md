# Bgame - אי המוח (גרסה ניסיונית)

A continuous learning and thinking world for grades ב-ג: a 3D island in third person, where every world is a subject. This first version includes one working world, **מכרות המספרים** (math, grades ב-ג), with memory, a learner model, rewards and a parents' area.

The full plan (three phases, research, curriculum map) is in [docs/PLAN.md](docs/PLAN.md).

## What works in this version

- **Third-person island** with 5 open portals, a Thinking Tree that grows with mastery, keyboard + a floating touch joystick (drift fixed and covered by an automated test).
- **⛏️ Mines of Numbers** (math): 13 topics for grades ב-ג, a placement journey, and a mistake-pattern classifier.
- **📚 Library of Words** (language): 8 topics - gender and number agreement, singular/plural (including exceptions), punctuation, opposites, synonyms, word families, roots, and reading comprehension with short stories (explicit, sequence, inference).
- **🔬 Nature Lab** (science): 8 topics - living/non-living, states of matter, materials, animals and habitats, teeth, plants, electricity and safety, mixtures. Common misconceptions get a dedicated explanation.
- **♟️ Thinking Arena**: tic-tac-toe, connect four (the original's blocking bug fixed) and the Towers of Hanoi. Difficulty adapts: two wins → up a level, three losses → down. The game records when the child spots a threat or misses a winning move, which feeds the "spot a threat" and "think a step ahead" strategies.
- **🤝 Friends Village** (values and friendship): 8 social situations with choices, consequences, a named skill and a question to talk about at home. No score, by design.
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
npm run build      # static build into dist/
```

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
