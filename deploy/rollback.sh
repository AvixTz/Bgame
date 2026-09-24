#!/usr/bin/env bash
# Go back to the previous release (or a named one). Run from any computer with the deploy key:
#   DEPLOY_HOST=server.example.com bash deploy/rollback.sh            # previous release
#   DEPLOY_HOST=server.example.com bash deploy/rollback.sh 20261001-120000-abc1234
set -euo pipefail
HOST="${DEPLOY_HOST:?set DEPLOY_HOST}"; USER_="${DEPLOY_USER:-deploy}"; PORT="${DEPLOY_PORT:-22}"; ROOT="${DEPLOY_PATH:-/var/www/bgame}"
TARGET="${1:-}"
ssh -p "$PORT" -o BatchMode=yes "$USER_@$HOST" "set -e
  cd '$ROOT'
  cur=\$(basename \$(readlink current))
  if [ -n '$TARGET' ]; then to='$TARGET'; else to=\$(ls -1t releases | grep -v placeholder | grep -vx \"\$cur\" | head -n1); fi
  test -f \"releases/\$to/index.html\" || { echo \"no such release: \$to\"; ls -1t releases; exit 1; }
  ln -sfn \"releases/\$to\" current.new && mv -Tf current.new current
  echo \"rolled back: \$cur -> \$to\""
