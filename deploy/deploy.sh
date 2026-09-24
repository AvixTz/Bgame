#!/usr/bin/env bash
# Deploy a build to the server. Used by the GitHub workflow, and can be run by hand from any
# computer that has the deploy SSH key:
#   DEPLOY_HOST=server.example.com DEPLOY_USER=deploy bash deploy/deploy.sh
# Uploads dist/ as a new release folder, switches the "current" link in one step (no half-updated
# site), and keeps the last 5 releases for rollback.
set -euo pipefail

HOST="${DEPLOY_HOST:?set DEPLOY_HOST}"
USER_="${DEPLOY_USER:-deploy}"
PORT="${DEPLOY_PORT:-22}"
ROOT="${DEPLOY_PATH:-/var/www/bgame}"
KEEP="${DEPLOY_KEEP:-5}"
SSH=(ssh -p "$PORT" -o BatchMode=yes)
REL="$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo manual)"

[ -f dist/index.html ] || { echo "dist/ is missing - run: npm ci && npm run build"; exit 1; }

echo "== uploading release $REL"
rsync -az --delete -e "ssh -p $PORT -o BatchMode=yes" dist/ "$USER_@$HOST:$ROOT/releases/$REL/"

echo "== switching to $REL"
"${SSH[@]}" "$USER_@$HOST" "set -e
  cd '$ROOT'
  test -f 'releases/$REL/index.html'
  ln -sfn 'releases/$REL' current.new && mv -Tf current.new current
  ls -1dt releases/*/ | grep -v placeholder | tail -n +$((KEEP + 1)) | xargs -r rm -rf
  echo active: \$(readlink current)"

echo "== checking the live site"
if [ -n "${DEPLOY_URL:-}" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' "$DEPLOY_URL")
  [ "$code" = 200 ] || { echo "site answered $code"; exit 1; }
  echo "ok: $DEPLOY_URL answers 200"
fi
