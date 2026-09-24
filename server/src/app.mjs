// HTTP API. Design rule that makes isolation hold by construction:
// NO route accepts a player id. Every read and write uses the id bound to the session cookie,
// so a child can only ever reach their own rows, whatever they send.
import { checkName, hashPin, newId, newToken, normalize, pinProblem, tokenHash, verifyPin } from './security.mjs';

const DAY = 86_400_000;
const SESSION_DAYS = 180;
const MAX_BODY = 512 * 1024;
const MAX_DOC = 400 * 1024;
const MAX_ATTEMPTS_PER_POST = 500;
const MAX_ATTEMPTS_PER_PLAYER = 50_000;
const LOCK_AFTER = 5;               // wrong codes in a row for one child
const LOCK_MS = 15 * 60_000;
const IP_LIMIT = 30;                // wrong codes per hour from one address, across all children
const COOKIE = 'bg_s';

export function createApp(db, opts = {}) {
  const now = opts.now ?? (() => Date.now());
  const secureCookie = opts.secureCookie ?? true;
  const log = opts.log ?? (() => {});

  const q = {
    playerByKeys: db.prepare('SELECT * FROM players WHERE name_key = ? AND school_key = ?'),
    playerById: db.prepare('SELECT id, name, school, created_at FROM players WHERE id = ?'),
    insertPlayer: db.prepare('INSERT INTO players (id, name, school, name_key, school_key, pin_hash, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    setFailed: db.prepare('UPDATE players SET failed = ?, locked_until = ? WHERE id = ?'),
    seen: db.prepare('UPDATE players SET last_seen = ?, failed = 0, locked_until = 0 WHERE id = ?'),
    deletePlayer: db.prepare('DELETE FROM players WHERE id = ?'),
    getDoc: db.prepare('SELECT json, version FROM docs WHERE player_id = ?'),
    insertDoc: db.prepare('INSERT INTO docs (player_id, json, version, updated_at) VALUES (?, ?, 1, ?)'),
    updateDoc: db.prepare('UPDATE docs SET json = ?, version = version + 1, updated_at = ? WHERE player_id = ? AND version = ?'),
    addAttempt: db.prepare('INSERT INTO attempts (player_id, at, json) VALUES (?, ?, ?)'),
    countAttempts: db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE player_id = ?'),
    pruneAttempts: db.prepare('DELETE FROM attempts WHERE id IN (SELECT id FROM attempts WHERE player_id = ? ORDER BY at ASC LIMIT ?)'),
    listAttempts: db.prepare('SELECT json FROM attempts WHERE player_id = ? AND at > ? ORDER BY at ASC LIMIT 20000'),
    newSession: db.prepare('INSERT INTO sessions (token_hash, player_id, expires_at) VALUES (?, ?, ?)'),
    session: db.prepare('SELECT player_id, expires_at FROM sessions WHERE token_hash = ?'),
    dropSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    dropExpired: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),
    ipFail: db.prepare('INSERT INTO ip_failures (ip, at) VALUES (?, ?)'),
    ipCount: db.prepare('SELECT COUNT(*) AS n FROM ip_failures WHERE ip = ? AND at > ?'),
    ipPrune: db.prepare('DELETE FROM ip_failures WHERE at < ?'),
  };

  const tx = (fn) => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

  const cookieHeader = (token, maxAgeSec) =>
    `${COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secureCookie ? '; Secure' : ''}`;

  function startSession(res, playerId) {
    const token = newToken();
    q.newSession.run(tokenHash(token), playerId, now() + SESSION_DAYS * DAY);
    res.setHeader('Set-Cookie', cookieHeader(token, SESSION_DAYS * 86400));
  }

  function sessionOf(req) {
    const m = /(?:^|;\s*)bg_s=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie ?? '');
    if (!m) return null;
    const s = q.session.get(tokenHash(m[1]));
    if (!s || s.expires_at < now()) return null;
    return { playerId: s.player_id, tokenHash: tokenHash(m[1]) };
  }

  const clientIp = (req) => String(req.headers['x-real-ip'] ?? req.socket.remoteAddress ?? 'unknown').slice(0, 64);
  const ipBlocked = (ip) => q.ipCount.get(ip, now() - 3_600_000).n >= IP_LIMIT;

  const publicPlayer = (p) => ({ id: p.id, name: p.name, school: p.school });

  function loadDoc(playerId) {
    const d = q.getDoc.get(playerId);
    return d ? { doc: JSON.parse(d.json), version: d.version } : { doc: null, version: 0 };
  }

  /** The stored doc always carries the server's id and name: the client cannot relabel itself. */
  function sanitizeDoc(doc, player) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
    return { ...doc, id: player.id, nickname: player.name };
  }

  // ---------------- routes ----------------
  async function register(req, res) {
    const b = await body(req);
    const name = checkName(b.name, 2, 30);
    const school = checkName(b.school, 2, 60);
    if (!name) return send(res, 400, { error: 'name' });
    if (!school) return send(res, 400, { error: 'school' });
    const pp = pinProblem(b.pin);
    if (pp) return send(res, 400, { error: `pin_${pp}` });
    if (ipBlocked(clientIp(req))) return send(res, 429, { error: 'slow_down' });
    const nk = normalize(name), sk = normalize(school);
    if (q.playerByKeys.get(nk, sk)) return send(res, 409, { error: 'taken' });
    const id = newId();
    const t = now();
    tx(() => {
      q.insertPlayer.run(id, name, school, nk, sk, hashPin(b.pin), t, t);
      const doc = sanitizeDoc(b.doc ?? {}, { id, name });
      if (doc) q.insertDoc.run(id, JSON.stringify(doc), t);
    });
    startSession(res, id);
    log('register');
    return send(res, 201, { player: { id, name, school }, ...loadDoc(id) });
  }

  async function login(req, res) {
    const b = await body(req);
    const ip = clientIp(req);
    if (ipBlocked(ip)) return send(res, 429, { error: 'slow_down' });
    const p = q.playerByKeys.get(normalize(b.name), normalize(b.school));
    // same answer for "no such child" and "wrong code"; still spend the scrypt time
    if (!p) { verifyPin('0000', 's1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='); q.ipFail.run(ip, now()); return send(res, 401, { error: 'wrong' }); }
    if (p.locked_until > now()) return send(res, 423, { error: 'locked', retryInMin: Math.ceil((p.locked_until - now()) / 60_000) });
    if (!verifyPin(String(b.pin ?? ''), p.pin_hash)) {
      const failed = p.failed + 1;
      q.setFailed.run(failed, failed >= LOCK_AFTER ? now() + LOCK_MS : 0, p.id);
      q.ipFail.run(ip, now());
      return send(res, 401, { error: 'wrong', left: Math.max(0, LOCK_AFTER - failed) });
    }
    q.seen.run(now(), p.id);
    startSession(res, p.id);
    log('login');
    return send(res, 200, { player: publicPlayer(p), ...loadDoc(p.id) });
  }

  function logout(req, res, s) {
    q.dropSession.run(s.tokenHash);
    res.setHeader('Set-Cookie', cookieHeader('x', 0));
    return send(res, 200, { ok: true });
  }

  function me(req, res, s) {
    const p = q.playerById.get(s.playerId);
    if (!p) return send(res, 401, { error: 'auth' });
    q.seen.run(now(), p.id);
    return send(res, 200, { player: publicPlayer(p), ...loadDoc(p.id) });
  }

  async function saveDoc(req, res, s) {
    const b = await body(req);
    const p = q.playerById.get(s.playerId);
    const doc = sanitizeDoc(b.doc, p);
    if (!doc) return send(res, 400, { error: 'doc' });
    const json = JSON.stringify(doc);
    if (json.length > MAX_DOC) return send(res, 413, { error: 'too_big' });
    const base = Number(b.version);
    const t = now();
    const cur = q.getDoc.get(p.id);
    if (!cur) { q.insertDoc.run(p.id, json, t); return send(res, 200, { version: 1 }); }
    const r = q.updateDoc.run(json, t, p.id, base);
    if (r.changes === 0) return send(res, 409, { error: 'conflict', ...loadDoc(p.id) });
    return send(res, 200, { version: base + 1 });
  }

  async function postAttempts(req, res, s) {
    const b = await body(req);
    const list = Array.isArray(b.attempts) ? b.attempts : null;
    if (!list || list.length > MAX_ATTEMPTS_PER_POST) return send(res, 400, { error: 'attempts' });
    const rows = [];
    for (const a of list) {
      if (!a || typeof a !== 'object') return send(res, 400, { error: 'attempts' });
      const json = JSON.stringify({ ...a, playerId: s.playerId });
      if (json.length > 4096) return send(res, 400, { error: 'attempt_too_big' });
      rows.push([Number.isFinite(a.at) ? a.at : now(), json]);
    }
    tx(() => {
      for (const [at, json] of rows) q.addAttempt.run(s.playerId, at, json);
      const n = q.countAttempts.get(s.playerId).n;
      if (n > MAX_ATTEMPTS_PER_PLAYER) q.pruneAttempts.run(s.playerId, n - MAX_ATTEMPTS_PER_PLAYER);
    });
    return send(res, 200, { saved: rows.length });
  }

  function getAttempts(req, res, s, url) {
    const since = Number(url.searchParams.get('since') ?? 0) || 0;
    const rows = q.listAttempts.all(s.playerId, since).map((r) => JSON.parse(r.json));
    return send(res, 200, { attempts: rows });
  }

  async function deleteMe(req, res, s) {
    const b = await body(req);
    const p = db.prepare('SELECT pin_hash FROM players WHERE id = ?').get(s.playerId);
    if (!p || !verifyPin(String(b.pin ?? ''), p.pin_hash)) return send(res, 401, { error: 'wrong' });
    q.deletePlayer.run(s.playerId);
    res.setHeader('Set-Cookie', cookieHeader('x', 0));
    log('delete');
    return send(res, 200, { deleted: true });
  }

  const routes = {
    'GET /api/health': { auth: false, fn: (req, res) => send(res, 200, { ok: true, mode: 'server' }) },
    'POST /api/register': { auth: false, fn: register },
    'POST /api/login': { auth: false, fn: login },
    'POST /api/logout': { auth: true, fn: logout },
    'GET /api/me': { auth: true, fn: me },
    'PUT /api/me': { auth: true, fn: saveDoc },
    'DELETE /api/me': { auth: true, fn: deleteMe },
    'POST /api/attempts': { auth: true, fn: postAttempts },
    'GET /api/attempts': { auth: true, fn: getAttempts },
  };

  let lastCleanup = 0;
  return async function handle(req, res) {
    const t0 = now();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (t0 - lastCleanup > 3_600_000) { lastCleanup = t0; q.dropExpired.run(t0); q.ipPrune.run(t0 - 3_600_000); }
      const url = new URL(req.url ?? '/', 'http://local');
      const route = routes[`${req.method} ${url.pathname}`];
      if (!route) return send(res, 404, { error: 'not_found' });
      if (req.method !== 'GET') {
        // CSRF guard on top of SameSite=Strict: browsers cannot send this header cross-site without CORS
        if (req.headers['x-bgame'] !== '1') return send(res, 403, { error: 'csrf' });
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return send(res, 415, { error: 'json_only' });
      }
      let s = null;
      if (route.auth) { s = sessionOf(req); if (!s) return send(res, 401, { error: 'auth' }); }
      await route.fn(req, res, s, url);
    } catch (e) {
      if (e?.status) return send(res, e.status, { error: e.code });
      log(`error ${e?.message}`);
      send(res, 500, { error: 'server' });
    } finally {
      log(`${req.method} ${String(req.url).split('?')[0]} ${res.statusCode} ${now() - t0}ms`);
    }
  };
}

function send(res, status, obj) {
  if (res.headersSent) return;
  const s = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too big'), { status: 413, code: 'too_big' });
    chunks.push(c);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('shape');
    return v;
  } catch {
    throw Object.assign(new Error('bad json'), { status: 400, code: 'bad_json' });
  }
}
