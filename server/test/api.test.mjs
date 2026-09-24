// Isolation and security tests. Run: npm test (in server/).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.mjs';
import { createApp } from '../src/app.mjs';

let server, base, dir, db, clock = Date.now();

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bgame-api-'));
  db = openDb(join(dir, 'test.sqlite'));
  server = createServer(createApp(db, { secureCookie: false, now: () => clock }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); db.close(); rmSync(dir, { recursive: true, force: true }); });

let ipCounter = 0;
async function call(method, path, { body, cookie, headers = {}, ip } = {}) {
  const h = { 'x-real-ip': ip ?? `10.0.0.${++ipCounter % 250}`, ...headers };
  if (method !== 'GET') { h['x-bgame'] ??= '1'; h['content-type'] ??= 'application/json'; }
  if (cookie) h.cookie = cookie;
  const res = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: setCookie?.split(';')[0], setCookie, headers: res.headers };
}

async function newChild(name, school = 'בית ספר הדר', pin = '7391', doc = { coins: 0 }) {
  const r = await call('POST', '/api/register', { body: { name, school, pin, doc } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return r;
}

test('register and read back only your own data', async () => {
  const a = await newChild('נועה', 'הדר', '7391', { coins: 5, nickname: 'hacker', id: 'p_evil' });
  const me = await call('GET', '/api/me', { cookie: a.cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.player.name, 'נועה');
  assert.equal(me.json.doc.coins, 5);
  // the server overrides id and nickname: a client cannot label its doc as someone else
  assert.equal(me.json.doc.id, me.json.player.id);
  assert.equal(me.json.doc.nickname, 'נועה');
  assert.match(a.setCookie, /HttpOnly/);
  assert.match(a.setCookie, /SameSite=Strict/);
  assert.match(a.setCookie, /Path=\/api/);
});

test("child A can never read or change child B's data", async () => {
  const a = await newChild('איתי', 'אלון', '5820', { coins: 1 });
  const b = await newChild('מאיה', 'אלון', '6047', { coins: 99, secret: 'של מאיה' });
  const bId = b.json.player.id;

  // A's session always resolves to A, whatever A sends
  const tries = [
    ['GET', `/api/me?id=${bId}`], ['GET', `/api/me/${bId}`], ['GET', `/api/players/${bId}`],
    ['GET', `/api/attempts?playerId=${bId}`], ['GET', `/api/attempts?player_id=${bId}&since=0`],
  ];
  for (const [m, p] of tries) {
    const r = await call(m, p, { cookie: a.cookie });
    assert.ok(!JSON.stringify(r.json).includes('של מאיה'), `${m} ${p} leaked`);
    assert.ok(!JSON.stringify(r.json).includes('"coins":99'), `${m} ${p} leaked`);
  }

  // writing with B's id in the body changes only A
  const va = (await call('GET', '/api/me', { cookie: a.cookie })).json.version;
  const w = await call('PUT', '/api/me', { cookie: a.cookie, body: { version: va, doc: { id: bId, playerId: bId, coins: 5000 } } });
  assert.equal(w.status, 200);
  const bAfter = await call('GET', '/api/me', { cookie: b.cookie });
  assert.equal(bAfter.json.doc.coins, 99);
  assert.equal(bAfter.json.doc.secret, 'של מאיה');
  const aAfter = await call('GET', '/api/me', { cookie: a.cookie });
  assert.equal(aAfter.json.doc.id, a.json.player.id);

  // attempts posted "for B" are stored for A
  await call('POST', '/api/attempts', { cookie: a.cookie, body: { attempts: [{ at: 1, nodeId: 'x', playerId: bId }] } });
  const bAtt = await call('GET', '/api/attempts', { cookie: b.cookie });
  assert.equal(bAtt.json.attempts.length, 0);
  const aAtt = await call('GET', '/api/attempts', { cookie: a.cookie });
  assert.equal(aAtt.json.attempts.length, 1);
  assert.equal(aAtt.json.attempts[0].playerId, a.json.player.id);

  // deleting "as B" with B's code but A's session deletes nothing of B
  const del = await call('DELETE', '/api/me', { cookie: a.cookie, body: { pin: '6047', id: bId } });
  assert.equal(del.status, 401);
  assert.equal((await call('GET', '/api/me', { cookie: b.cookie })).status, 200);
});

test('no session, a forged or an expired session gets nothing', async () => {
  for (const cookie of [undefined, 'bg_s=', 'bg_s=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', "bg_s=' OR 1=1 --"]) {
    for (const [m, p] of [['GET', '/api/me'], ['GET', '/api/attempts'], ['PUT', '/api/me'], ['POST', '/api/attempts'], ['DELETE', '/api/me'], ['POST', '/api/logout']]) {
      const r = await call(m, p, { cookie, body: m === 'GET' ? undefined : {} });
      assert.equal(r.status, 401, `${m} ${p} with ${cookie}`);
    }
  }
  const c = await newChild('רוני', 'תמר');
  clock += 181 * 86_400_000;
  assert.equal((await call('GET', '/api/me', { cookie: c.cookie })).status, 401);
  clock -= 181 * 86_400_000;
});

test('logout ends the session on the server', async () => {
  const c = await newChild('אורי', 'גפן');
  assert.equal((await call('POST', '/api/logout', { cookie: c.cookie, body: {} })).status, 200);
  assert.equal((await call('GET', '/api/me', { cookie: c.cookie })).status, 401);
});

test('login: right code works, wrong code does not say whether the child exists', async () => {
  await newChild('שירה', 'רימון', '4826');
  const ok = await call('POST', '/api/login', { body: { name: ' שירה ', school: 'רימון', pin: '4826' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.cookie);
  const wrongPin = await call('POST', '/api/login', { body: { name: 'שירה', school: 'רימון', pin: '1357' } });
  const noChild = await call('POST', '/api/login', { body: { name: 'אין כזה', school: 'רימון', pin: '1357' } });
  assert.equal(wrongPin.status, 401);
  assert.equal(noChild.status, 401);
  assert.equal(wrongPin.json.error, noChild.json.error);
});

test('guessing codes locks the child for 15 minutes', async () => {
  await newChild('גיל', 'ברוש', '8264');
  for (let i = 0; i < 5; i++) await call('POST', '/api/login', { body: { name: 'גיל', school: 'ברוש', pin: String(3000 + i) } });
  const locked = await call('POST', '/api/login', { body: { name: 'גיל', school: 'ברוש', pin: '8264' } });
  assert.equal(locked.status, 423);
  clock += 16 * 60_000;
  assert.equal((await call('POST', '/api/login', { body: { name: 'גיל', school: 'ברוש', pin: '8264' } })).status, 200);
});

test('one address guessing across many children is slowed down', async () => {
  const ip = '203.0.113.9';
  for (let i = 0; i < 30; i++) await call('POST', '/api/login', { ip, body: { name: `ילד${i}`, school: 'x', pin: '9182' } });
  assert.equal((await call('POST', '/api/login', { ip, body: { name: 'נועה', school: 'הדר', pin: '7391' } })).status, 429);
  clock += 61 * 60_000;
  assert.equal((await call('POST', '/api/login', { ip, body: { name: 'נועה', school: 'הדר', pin: '7391' } })).status, 200);
});

test('registration rules: unique name per school, 4-digit non-trivial code, clean names', async () => {
  await newChild('דניאל', 'אורן');
  assert.equal((await call('POST', '/api/register', { body: { name: 'דניאל', school: ' אורן', pin: '5173' } })).status, 409);
  assert.equal((await call('POST', '/api/register', { body: { name: 'דניאל', school: 'שקד', pin: '5173' } })).status, 201);
  for (const pin of ['1234', '0000', '12345', 'abcd', '']) assert.equal((await call('POST', '/api/register', { body: { name: 'יעל', school: 'שקד', pin } })).status, 400, pin);
  for (const name of ['<script>', 'a', "'; DROP TABLE players; --", 'x'.repeat(40)]) assert.equal((await call('POST', '/api/register', { body: { name, school: 'שקד', pin: '5173' } })).status, 400, name);
  assert.equal((await call('GET', '/api/me', { cookie: (await newChild("ג'ני", 'שקד')).cookie })).json.player.name, "ג'ני");
});

test('cross-site style requests are refused', async () => {
  const c = await newChild('תמר', 'זית');
  assert.equal((await call('PUT', '/api/me', { cookie: c.cookie, headers: { 'x-bgame': '0' }, body: { doc: {} } })).status, 403);
  assert.equal((await call('PUT', '/api/me', { cookie: c.cookie, headers: { 'content-type': 'text/plain' }, body: { doc: {} } })).status, 415);
});

test('sizes are limited', async () => {
  const c = await newChild('עומר', 'דקל');
  const v = (await call('GET', '/api/me', { cookie: c.cookie })).json.version;
  assert.equal((await call('PUT', '/api/me', { cookie: c.cookie, body: { version: v, doc: { big: 'x'.repeat(450_000) } } })).status, 413);
  assert.equal((await call('PUT', '/api/me', { cookie: c.cookie, body: 'x'.repeat(600_000) })).status, 413);
  assert.equal((await call('POST', '/api/attempts', { cookie: c.cookie, body: { attempts: Array(501).fill({ at: 1 }) } })).status, 400);
  assert.equal((await call('POST', '/api/register', { body: '{not json' })).status, 400);
});

test('two devices of the same child: stale writes are refused, not silently merged', async () => {
  const c = await newChild('אמיר', 'ארז');
  const v = (await call('GET', '/api/me', { cookie: c.cookie })).json.version;
  assert.equal((await call('PUT', '/api/me', { cookie: c.cookie, body: { version: v, doc: { coins: 1 } } })).status, 200);
  const stale = await call('PUT', '/api/me', { cookie: c.cookie, body: { version: v, doc: { coins: 2 } } });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.doc.coins, 1);
});

test('a child can delete all of their data with their code', async () => {
  const c = await newChild('הילה', 'לוטם', '6284');
  await call('POST', '/api/attempts', { cookie: c.cookie, body: { attempts: [{ at: 5 }] } });
  assert.equal((await call('DELETE', '/api/me', { cookie: c.cookie, body: { pin: '0001' } })).status, 401);
  assert.equal((await call('DELETE', '/api/me', { cookie: c.cookie, body: { pin: '6284' } })).status, 200);
  assert.equal((await call('GET', '/api/me', { cookie: c.cookie })).status, 401);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM attempts WHERE json LIKE ?').get(`%${c.json.player.id}%`).n, 0);
  assert.equal((await call('POST', '/api/login', { body: { name: 'הילה', school: 'לוטם', pin: '6284' } })).status, 401);
});

test('codes are stored hashed, never in plain text', async () => {
  await newChild('יוסף', 'אלה', '9053');
  const row = db.prepare("SELECT pin_hash FROM players WHERE name = 'יוסף'").get();
  assert.ok(!row.pin_hash.includes('9053'));
  assert.match(row.pin_hash, /^s1\$/);
});

test('responses are never cached and unknown routes are 404', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await call('GET', '/api/../../etc/passwd')).status, 404);
  assert.equal((await call('GET', '/api/admin')).status, 404);
});
