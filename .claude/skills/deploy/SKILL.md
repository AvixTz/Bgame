---
name: deploy
description: Build and deploy Bgame - to the owner's own server (static hosting behind nginx) or as a single-file HTML preview. Use when asked to deploy, publish, release or move to production.
---
# Deploy

Preconditions: `npm run typecheck && npm test` pass, and the `playtest` skill was run on this build.

## Own server (production)
1. `npm ci && npm run build` → `dist/`.
2. Copy: `rsync -av --delete dist/ <user>@<server>:/var/www/bgame/` (ask the owner for host and user;
   never guess credentials, never store them in the repo).
3. nginx site:
   ```nginx
   server {
     server_name <domain>;
     root /var/www/bgame;
     location / { try_files $uri /index.html; }
     location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
     gzip on; gzip_types application/javascript text/css;
   }
   ```
   HTTPS via certbot. IndexedDB and speech synthesis behave better on HTTPS.
4. Smoke test the live URL with the `playtest` checklist (desktop + phone).

## Single-file preview
`node build-artifact.mjs <outDir>` writes `<outDir>/bgame.html` with JS and CSS inlined.
