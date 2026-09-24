// Server-mode end-to-end: sign up, play, progress survives on a brand-new device, and children are
// isolated. Needs the site + data server behind nginx (deploy/setup-server.sh + deploy/setup-api.sh).
// Usage: PLAYTEST_URL=https://your-domain/ node tests/e2e/server-mode.mjs   (creates two test children)
import { chromium } from 'playwright';
const BASE = process.env.PLAYTEST_URL ?? 'http://localhost/';
const stamp = [...Date.now().toString(10).slice(-5)].map((d) => 'אבגדהוזחטי'[Number(d)]).join('');
const A = { name: `בדיקה א${stamp}`, school: 'בית ספר בדיקות', pin: '5829' };
const B = { name: `בדיקה ב${stamp}`, school: 'בית ספר בדיקות', pin: '6173' };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const results = {};

async function device() {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page };
}
async function signUp(page, c) {
  await page.goto(BASE);
  await page.click('text=פעם ראשונה');
  await page.fill('input[autocomplete=username]', c.name);
  await page.fill('input[autocomplete=organization]', c.school);
  const pins = await page.$$('input.pin-input');
  await pins[0].fill(c.pin); await pins[1].fill(c.pin);
  await page.click('button:has-text("הרשמה")');
  await page.waitForSelector('text=כרטיס הכניסה שלך');
  await page.click('text=יוצאים לדרך!');
  await page.waitForSelector('canvas');
}
async function signIn(page, c) {
  await page.goto(BASE);
  await page.waitForSelector('text=כבר נרשמתי');
  await page.click('text=כבר נרשמתי');
  await page.fill('input[autocomplete=username]', c.name);
  await page.fill('input[autocomplete=organization]', c.school);
  await page.fill('input.pin-input', c.pin);
  await page.click('button:has-text("כניסה")');
  await page.waitForSelector('canvas');
}
const coins = (page) => page.evaluate(() => fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()).then((j) => j.doc?.coins));

// 1. child A signs up and earns coins by solving a puzzle
const a1 = await device();
await signUp(a1.page, A);
await a1.page.waitForTimeout(1500);
await a1.page.evaluate(() => { window.__teleport = [Math.sin(1.05) * 10.8, Math.cos(1.05) * 10.8]; });
await (await a1.page.waitForSelector('text=כניסה לגן החידות')).click();
await a1.page.waitForTimeout(800);
await a1.page.click('text=תפזורת תרגילים'); await a1.page.waitForTimeout(300);
const ex = await a1.page.evaluate(() => {
  const cells = [...document.querySelectorAll('.ms-cell')]; const n = Math.round(Math.sqrt(cells.length));
  const T = (r, c) => cells[r * n + c].textContent.replace('−', '-').replace('×', '*');
  const ok = (t) => { if (!/^\d+$/.test(t[0]) || !/^\d+$/.test(t[4])) return false; if ([t[1], t[3]].filter((x) => x === '=').length !== 1) return false; const f = (a, o, b) => (o === '+' ? a + b : o === '-' ? a - b : a * b); const [x, o1, y, o2, z] = t; return o2 === '=' ? f(+x, o1, +y) === +z : +x === f(+y, o2, +z); };
  const out = [];
  for (let r = 0; r < n; r += 2) for (let c = 0; c + 4 < n; c += 2) if (ok([0, 1, 2, 3, 4].map((i) => T(r, c + i)))) out.push([`${r},${c}`, `${r},${c + 4}`]);
  for (let c = 0; c < n; c += 2) for (let r = 0; r + 4 < n; r += 2) if (ok([0, 1, 2, 3, 4].map((i) => T(r + i, c)))) out.push([`${r},${c}`, `${r + 4},${c}`]);
  return out;
});
for (const [s, e] of ex) {
  await a1.page.$eval('.ms-grid', (el) => el.scrollIntoView({ block: 'center' }));
  const b1 = await (await a1.page.$(`[data-cell="${s}"]`)).boundingBox(); const b2 = await (await a1.page.$(`[data-cell="${e}"]`)).boundingBox();
  await a1.page.mouse.move(b1.x + b1.width / 2, b1.y + b1.height / 2); await a1.page.mouse.down();
  await a1.page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 5 }); await a1.page.mouse.up();
  await a1.page.waitForTimeout(120);
}
await a1.page.waitForSelector('text=מצאת את כל התרגילים הנכונים');
await a1.page.waitForTimeout(2500); // let the batched save go out
results.aCoinsOnServer = await coins(a1.page);

// 2. a brand-new device (no local data at all) signs in as A: progress comes from the server
const a2 = await device();
await signIn(a2.page, A);
results.aCoinsOnNewDevice = await a2.page.$eval('.coin-pill, [class*=coin]', (e) => e.textContent).catch(() => null);
results.aCoinsNewDeviceApi = await coins(a2.page);

// 3. child B signs up on another device and sees only B
const b1d = await device();
await signUp(b1d.page, B);
await b1d.page.waitForTimeout(1500);
results.bCoins = await coins(b1d.page);
results.bSeesOwnName = await b1d.page.evaluate(() => fetch('/api/me').then((r) => r.json()).then((j) => j.player.name));

// 4. from A's browser, every way to ask for B's data returns A's data or nothing
const aId = await a1.page.evaluate(() => fetch('/api/me').then((r) => r.json()).then((j) => j.player.id));
const bId = await b1d.page.evaluate(() => fetch('/api/me').then((r) => r.json()).then((j) => j.player.id));
results.leak = await a1.page.evaluate(async ({ bId, bName }) => {
  const paths = [`/api/me?id=${bId}`, `/api/me/${bId}`, `/api/players/${bId}`, `/api/attempts?playerId=${bId}`, `/api/admin`, `/api/../../etc/passwd`];
  const bodies = await Promise.all(paths.map((p) => fetch(p).then((r) => r.text())));
  const put = await fetch('/api/me', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Bgame': '1' }, body: JSON.stringify({ version: 0, doc: { id: bId, coins: 9999 } }) });
  return bodies.some((b) => b.includes(bName)) || put.status === 200 && false;
}, { bId, bName: B.name });
results.bCoinsAfterAttack = await coins(b1d.page);
results.differentIds = aId !== bId;

// 5. sign out ends the session
await a2.page.click('[aria-label="החלפת שחקן"]');
await a2.page.waitForSelector('text=כבר נרשמתי');
results.afterLogout = await a2.page.evaluate(() => fetch('/api/me').then((r) => r.status));

await browser.close();
console.log('RESULTS', JSON.stringify(results));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
const ok = results.aCoinsOnServer > 0 && results.aCoinsNewDeviceApi === results.aCoinsOnServer && results.bCoins === 0
  && results.bSeesOwnName === B.name && results.leak === false && results.bCoinsAfterAttack === 0 && results.differentIds && results.afterLogout === 401 && !errors.length;
console.log(ok ? 'SERVER MODE PASSED' : 'SERVER MODE FAILED');
process.exit(ok ? 0 : 1);
