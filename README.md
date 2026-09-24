# Bgame - אי המוח (גרסה ניסיונית)

A continuous learning and thinking world for grades ב-ג: a 3D island in third person, where every world is a subject. This first version includes one working world, **מכרות המספרים** (math, grades ב-ג), with memory, a learner model, rewards and a parents' area.

The full plan (three phases, research, curriculum map) is in [docs/PLAN.md](docs/PLAN.md).

## What works in this version

- **Island in third person**: movement with arrow keys/WASD or a touch joystick, portals to 5 worlds (the mines are open, the rest say "coming soon"), and a Thinking Tree that grows with every mastered topic.
- **Player profiles**: several children on one device. Each has a nickname (not a full name), boy/girl for Hebrew addressing, a grade, and an avatar color.
- **Placement journey**: 6 adaptive exercises that find where the child really stands.
- **Mines of Numbers**: 13 curriculum topics for grades ב-ג (tens and units, addition and subtraction with and without regrouping, missing numbers, the multiplication table, division with and without remainder, word problems), 3 difficulty tiers per topic.
- **Daily journey**: 8 exercises. Due reviews come first, then the topic that needs work, and occasionally a new topic.
- **The brain**: Elo per topic and per thinking strategy, a success target of about 80%, mastery, spaced review (1-3-7-14-30 days), and classification of mistake patterns (forgot the carry, subtracted smaller from larger, skip-count slip...).
- **Hints in 3 levels**, a second try after a mistake with feedback on the specific mistake, a worked solution, and a question after solving: "how did you solve it?"
- **Rewards**: coins for success (not for time), mastery badges, surprise treasures, an avatar shop, and a weekly goal of 5 out of 7 days with no "you lost your streak".
- **Parents' area** (hold for 3 seconds): strengths, what to strengthen, mistake patterns, strategies, a topic map, and a question for an evening conversation.
- Everything is saved in the device's IndexedDB. There is no server yet.

## Running

```bash
cd Bgame
npm install
npm run dev        # development at http://localhost:5173
npm test           # tests for the brain (generators, model, insights)
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
src/minigames/   the Mines of Numbers
src/ui/          profiles, HUD, shop, parents' area
```

## Known limitations

- Curriculum topics are based on Ministry of Education documents and have not yet been approved by a teacher.
- Hebrew text-to-speech depends on the device (a Hebrew voice exists on Android, iOS and Windows; not always on Linux).
- Only the Mines of Numbers world is open. The library, lab, village and arena are marked "coming soon".
