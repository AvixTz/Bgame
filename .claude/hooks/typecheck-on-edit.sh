#!/usr/bin/env bash
# PostToolUse hook: after editing TypeScript under src/, run the typechecker and report errors.
file=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null)
case "$file" in
  */src/*.ts|*/src/*.tsx) ;;
  *) exit 0 ;;
esac
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
out=$(npx tsc --noEmit 2>&1 | head -30)
if [ -n "$out" ]; then
  echo "TypeScript errors after editing $file:" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
