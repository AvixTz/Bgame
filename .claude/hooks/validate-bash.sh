#!/usr/bin/env bash
# PreToolUse hook: block destructive shell commands. Exit 2 = block, stderr goes back to Claude.
cmd=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
block() { echo "Blocked by .claude/hooks/validate-bash.sh: $1" >&2; exit 2; }
case "$cmd" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf *"*) block "recursive delete of a root, home or wildcard path" ;;
  *"git push"*"--force"*|*"git push -f"*) block "force push" ;;
  *"git reset --hard"*) block "hard reset discards work; stash or commit instead" ;;
  *"drop database"*|*"DROP DATABASE"*) block "dropping a database" ;;
  *"curl"*"| sh"*|*"curl"*"| bash"*|*"wget"*"| sh"*) block "piping a download into a shell" ;;
esac
exit 0
