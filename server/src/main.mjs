// Starts the data server. In production it listens ONLY on a unix socket shared with nginx
// (the container has no network at all). For local development: PORT=8787.
import { createServer } from 'node:http';
import { chmodSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { openDb } from './db.mjs';
import { createApp } from './app.mjs';

const dataDir = process.env.DATA_DIR ?? '/data';
mkdirSync(dataDir, { recursive: true });
const db = openDb(join(dataDir, 'bgame.sqlite'));
const handle = createApp(db, {
  secureCookie: process.env.COOKIE_SECURE !== '0',
  // no personal data in logs: method, path, status, time only
  log: (m) => process.stdout.write(`${new Date().toISOString()} ${m}\n`),
});
const server = createServer({ headersTimeout: 10_000, requestTimeout: 15_000 }, handle);
server.maxHeadersCount = 50;

const socket = process.env.SOCKET_PATH;
if (socket) {
  mkdirSync(dirname(socket), { recursive: true });
  if (existsSync(socket)) unlinkSync(socket);
  server.listen(socket, () => {
    chmodSync(socket, 0o660); // owner + group (nginx's group) only
    console.log(`bgame-api listening on ${socket}`);
  });
} else {
  const port = Number(process.env.PORT ?? 8787);
  server.listen(port, '127.0.0.1', () => console.log(`bgame-api on http://127.0.0.1:${port}`));
}

const stop = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
