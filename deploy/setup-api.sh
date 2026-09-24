#!/usr/bin/env bash
# Installs (or updates) the Bgame data server in its sealed container. Run ON THE SERVER, from the
# repository or kit folder, after setup-server.sh:
#   sudo bash deploy/setup-api.sh
# Needs Docker with the compose plugin. Safe to run again for updates: data is kept.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/bgame-api
BASE=/srv/bgame-api
UID_API=10501
NGINX_USER="$(ps -o user= -C nginx 2>/dev/null | grep -v root | head -1 || true)"
NGINX_USER="${NGINX_USER:-www-data}"
NGINX_GID="$(id -g "$NGINX_USER")"

command -v docker >/dev/null || { echo "Docker is not installed. See https://docs.docker.com/engine/install/"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "The docker compose plugin is missing (apt install docker-compose-plugin)"; exit 1; }

echo "== system user for the data (no login, no shell)"
id -u bgame-api >/dev/null 2>&1 || useradd --system --uid "$UID_API" --no-create-home --shell /usr/sbin/nologin bgame-api

echo "== folders"
install -d -m 700 -o "$UID_API" -g root "$BASE/data"               # only the container can read children's data
install -d -m 700 -o "$UID_API" -g root "$BASE/data/backups"
install -d -m 750 -o "$UID_API" -g "$NGINX_GID" "$BASE/run"       # nginx may reach the socket, nothing else

echo "== code"
install -d -m 755 "$APP"
rsync -a --delete --exclude test "$HERE/server/" "$APP/"

echo "== build and start the sealed container"
cd "$APP"
NGINX_GID="$NGINX_GID" docker compose up -d --build
for i in $(seq 1 30); do [ -S "$BASE/run/api.sock" ] && break; sleep 1; done
[ -S "$BASE/run/api.sock" ] || { echo "the data server did not start:"; docker logs --tail 30 bgame-api; exit 1; }

echo "== checks"
docker inspect -f 'network: {{.HostConfig.NetworkMode}} | read-only: {{.HostConfig.ReadonlyRootfs}} | user: {{.Config.User}}' bgame-api
sudo -u "$NGINX_USER" curl -s --unix-socket "$BASE/run/api.sock" http://x/api/health && echo
if docker exec bgame-api node -e "fetch('https://example.com').then(()=>process.exit(1)).catch(()=>process.exit(0))"; then
  echo "ok: the container has no internet access"
else
  echo "WARNING: the container reached the internet"; exit 1
fi

echo "== nightly backup (kept 14 days, inside $BASE/data/backups)"
cat > /etc/cron.d/bgame-backup <<CRON
15 3 * * * root docker exec bgame-api node --disable-warning=ExperimentalWarning src/admin.mjs backup /data/backups/bgame-\$(date +\%F).sqlite >/dev/null && find $BASE/data/backups -name 'bgame-*.sqlite' -mtime +14 -delete
CRON

systemctl reload nginx 2>/dev/null || nginx -s reload
echo "Done. The game now saves progress on this server."
