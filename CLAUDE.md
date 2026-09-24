@AGENTS.md

## Claude Code specifics

- Open Claude Code in this `Bgame/` directory so `.claude/` (rules, skills, agents, hooks) loads.
- Personal overrides go in `CLAUDE.local.md` and `.claude/settings.local.json` (both git-ignored).
- Skills in `.claude/skills/`:
  - project: `add-minigame`, `add-curriculum-content`, `playtest`, `deploy`
  - vendored (see `.claude/skills/THIRD_PARTY.md`): `threejs-gameplay-systems`,
    `threejs-qa-release`, `threejs-debug-profiler`, `r3f-mobile-input`, `webapp-testing`
- Sub-agents in `.claude/agents/`: `pedagogy-reviewer` (content vs. curriculum and learning
  research), `child-safety-auditor` (dark patterns, privacy), `hebrew-copy-editor` (gender, RTL,
  kid-level Hebrew), `code-reviewer`.
- Hooks: `validate-bash.sh` blocks destructive shell commands; `typecheck-on-edit.sh` runs
  `tsc --noEmit` after edits to `src/**/*.ts(x)` and reports errors back.
- Changes to learning content go through `pedagogy-reviewer` and `hebrew-copy-editor` before commit.
- Verify gameplay changes in a real browser with the `playtest` skill (desktop and phone viewport).
