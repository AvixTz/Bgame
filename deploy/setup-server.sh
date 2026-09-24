#!/usr/bin/env bash
# One-time server setup for Bgame (Debian / Ubuntu). Run ON THE SERVER as a sudo user:
#   sudo bash setup-server.sh bgame.example.co.il you@example.com
# What it does: installs nginx + certbot, creates a "deploy" user that can only write the game
# folder, installs the nginx site and gets a free HTTPS certificate. Safe to run twice.
set -euo pipefail

DOMAIN="${1:?usage: sudo bash setup-server.sh <game-domain> <email-for-ssl-notices>}"
EMAIL="${2:?usage: sudo bash setup-server.sh <game-domain> <email-for-ssl-notices>}"
ROOT=/var/www/bgame
DEPLOY_USER=deploy

echo "== packages"
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx rsync

echo "== deploy user (no password, SSH key only)"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "Bgame deploy" "$DEPLOY_USER"
fi
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"

echo "== game folder"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ROOT" "$ROOT/releases"
if [ ! -e "$ROOT/current" ]; then
  install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ROOT/releases/placeholder"
  echo '<!doctype html><meta charset="utf-8"><title>Bgame</title><p dir="rtl">המשחק יעלה בקרוב.</p>' > "$ROOT/releases/placeholder/index.html"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$ROOT/releases/placeholder"
  ln -sfn "$ROOT/releases/placeholder" "$ROOT/current"
  chown -h "$DEPLOY_USER:$DEPLOY_USER" "$ROOT/current"
fi

echo "== nginx site"
SITE=/etc/nginx/sites-available/bgame
HERE="$(cd "$(dirname "$0")" && pwd)"
sed "s/GAME_DOMAIN/$DOMAIN/g" "$HERE/nginx/bgame.conf" > "$SITE"
ln -sfn "$SITE" /etc/nginx/sites-enabled/bgame
nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null || nginx

if [ "${SKIP_TLS:-0}" = 1 ]; then
  echo "== HTTPS skipped (SKIP_TLS=1). Run later: sudo certbot --nginx -d $DOMAIN"
else
  echo "== HTTPS (the domain's DNS must already point to this server)"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
  systemctl reload nginx
fi

echo
echo "Done. Next: put the deploy public key in /home/$DEPLOY_USER/.ssh/authorized_keys"
echo "Then open https://$DOMAIN - you should see 'המשחק יעלה בקרוב' until the first deploy."
