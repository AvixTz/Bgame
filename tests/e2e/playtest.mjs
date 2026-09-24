// Full playtest: movement/drift checks, every world, arena, village, parent area, phone view.
// Usage: npm run build && npx vite preview --port 4173 & npm run playtest
import { chromium } from 'playwright';
const OUT = process.env.PLAYTEST_OUT ?? 'playtest-shots';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const BASE = process.env.PLAYTEST_URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const pos = () => page.evaluate(() => [window.__bgamePos.x, window.__bgamePos.z]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// Wait for rendered frames, not milliseconds: a software-rendered headless browser may draw ~2 fps.
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const results = {};

await page.goto(BASE);
await page.waitForSelector('text=שחקן חדש');
await page.fill('input.input', 'נועה'); await page.click('text=בת'); await page.click("text=כיתה ג'");
await page.click('text=יוצאים לדרך!');
await page.waitForSelector('canvas'); await page.waitForTimeout(2500);

// --- joystick drift test ---
const zone = await page.$('[data-testid=joystick]');
const zb = await zone.boundingBox();
const cx = zb.x + zb.width / 2, cy = zb.y + zb.height / 2;
let p0 = await pos();
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx, cy - 45, { steps: 5 });
await frames(14);
let p1 = await pos();
results.joystickMoves = dist(p0, p1).toFixed(2);
await shot('01-joystick-drag');
await page.mouse.up();
await frames(6);
let p2 = await pos();
await frames(20);
let p3 = await pos();
results.driftAfterRelease = dist(p2, p3).toFixed(3);

// release outside the joystick zone (finger slides off)
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx + 40, cy - 30, { steps: 4 });
await frames(8);
await page.mouse.move(800, 200, { steps: 4 });
await page.mouse.up();
await frames(6);
p2 = await pos(); await frames(20); p3 = await pos();
results.driftAfterReleaseOutside = dist(p2, p3).toFixed(3);

// drag while walking into a portal zone, then release (old bug: joystick unmounted mid-drag)
await page.evaluate(() => { const a = Math.PI - 0.6; window.__teleport = [Math.sin(a) * 11.2, Math.cos(a) * 11.2]; });
await frames(6);
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx, cy - 40, { steps: 4 });
await frames(10);
await shot('02-drag-into-portal');
await page.mouse.up();
await frames(6);
p2 = await pos(); await frames(20); p3 = await pos();
results.driftAfterPortalDrag = dist(p2, p3).toFixed(3);

// keyboard
p0 = await pos();
await page.keyboard.down('ArrowDown'); await frames(12); await page.keyboard.up('ArrowDown');
await frames(6); p2 = await pos(); await frames(20); p3 = await pos();
results.keyboardMoves = dist(p0, p2).toFixed(2);
results.driftAfterKeyUp = dist(p2, p3).toFixed(3);
console.log('MOVEMENT', JSON.stringify(results));

const enter = async (angle, label) => {
  await page.evaluate((a) => { window.__teleport = [Math.sin(a) * 10.8, Math.cos(a) * 10.8]; }, angle);
  await frames(5);
  const btn = await page.$(`text=כניסה ל${label}`);
  if (!btn) { console.log('NO PORTAL BUTTON', label); await shot('portal-missing-' + label); return false; }
  await btn.click(); await page.waitForTimeout(1000); return true;
};
const answerChoices = async (n, prefix) => {
  for (let i = 0; i < n * 4 + 4; i++) {
    if (await page.$('text=המסע של היום הושלם')) break;
    const cont = await page.$('button:has-text("המשך")');
    if (cont) { await cont.click(); await page.waitForTimeout(150); continue; }
    const ch = await page.$$('.choice:not([disabled])');
    if (!ch.length) { await page.waitForTimeout(200); continue; }
    if (i === 1) await shot(prefix + '-question');
    await ch[0].click(); await page.click('button.btn-pink:has-text("בד")'); await page.waitForTimeout(200);
    if (i === 1) await shot(prefix + '-feedback');
  }
  await page.waitForTimeout(300);
  await shot(prefix + '-summary');
};

// library
if (await enter(Math.PI + 0.6, 'ספריית המילים')) {
  await shot('03-library-lobby');
  await page.click('button:has-text("למסע של היום")');
  await answerChoices(8, '04-library');
  await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
}
// lab
if (await enter(1.75, 'מעבדת הטבע')) {
  await shot('05-lab-lobby');
  await page.click('button:has-text("למסע של היום")');
  await answerChoices(8, '06-lab');
  await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
}
// arena
if (await enter(0.3, 'ארנה החשיבה')) {
  await shot('07-arena');
  await page.click('text=איקס עיגול'); await page.waitForTimeout(300);
  await page.click('.level-picker [role=radio] >> nth=2'); await page.waitForTimeout(200);
  await shot('07b-level-3');
  await page.click('.level-picker [role=radio] >> nth=0'); await page.waitForTimeout(200);
  for (let k = 0; k < 6; k++) {
    if (await page.$('text=עוד משחק')) break;
    const cells = await page.$$('.ttt-cell');
    for (const c of cells) { if (!(await c.textContent()).trim()) { await c.click(); break; } }
    await page.waitForTimeout(700);
  }
  await page.click('button:has-text("רמז")').catch(() => {});
  await shot('08-ttt');
  await page.click('button:has-text("לזירה")');
  await page.click('text=ארבע בשורה'); await page.waitForTimeout(300);
  for (let k = 0; k < 4; k++) { await page.click(`.c4-cell >> nth=${38 - k % 2}`); await page.waitForTimeout(700); }
  await page.click('button:has-text("רמז")').catch(() => {});
  await shot('09-c4');
  await page.click('button:has-text("לזירה")');
  await page.click('text=מגדלי האנוי'); await page.waitForTimeout(300);
  for (let k = 0; k < 7; k++) {
    await page.click('button:has-text("רמז")');
    const from = await page.$('.peg.hint-from'); const to = await page.$('.peg.hint-to');
    if (!from || !to) break;
    await from.click(); await to.click(); await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  await shot('10-hanoi');
  await page.click('button:has-text("לזירה")'); await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
}
// village
if (await enter(-1.75, 'כפר החברים')) {
  await shot('11-village');
  await page.click('.tunnel >> nth=0'); await page.waitForTimeout(300);
  await page.click('.choice >> nth=1'); await page.waitForTimeout(200);
  await shot('12-village-outcome');
  await page.click('text=סיימתי'); await page.waitForTimeout(200);
  await shot('13-village-reflect');
  await page.click('text=חזרה לכפר');
  // values quiz: a full round of 8 situations, trying options until the best one is found
  await page.click('button:has-text("סבב")'); await page.waitForTimeout(300);
  for (let k = 0; k < 60; k++) {
    if (await page.$('text=סיימת סבב')) break;
    const next = await page.$('.values-q button:has-text("המשך"), .values-q button:has-text("סיימתי")');
    if (next) { await next.click(); await page.waitForTimeout(150); continue; }
    const ch = await page.$$('.values-q .choice:not([disabled])');
    if (!ch.length) { await page.waitForTimeout(150); continue; }
    await ch[0].click(); await page.waitForTimeout(120);
    if (k === 0) await shot('13b-values-feedback');
  }
  results.valuesRoundDone = !!(await page.$('text=סיימת סבב'));
  await shot('13c-values-end');
  await page.click('text=חזרה לכפר'); await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
}
// puzzle garden: solve a whole word search and exercise search by selecting the answers
if (await enter(1.05, 'גן החידות')) {
  await shot('13g-puzzles');
  await page.click('text=תפזורת מילים'); await page.click('.cat >> nth=0'); await page.waitForTimeout(300);
  const cellCenter = async (sel) => { await page.$eval('.ws-grid, .ms-grid', (e) => e.scrollIntoView({ block: 'center' })); const b = await (await page.$(sel)).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const words = await page.evaluate(() => [...document.querySelectorAll('.word-list li')].length);
  // read the answers from the grid DOM: find each word by trying every straight line
  const lines = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.ws-cell')];
    const n = Math.round(Math.sqrt(cells.length));
    const L = (r, c) => cells[r * n + c]?.textContent ?? '';
    const words = [...document.querySelectorAll('.word-list li')].map((li) => li.textContent);
    const out = [];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];
    for (const w of words) {
      search: for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of dirs) {
        let ok = true;
        for (let i = 0; i < w.length; i++) { const y = r + dr * i, x = c + dc * i; if (y < 0 || x < 0 || y >= n || x >= n || L(y, x) !== w[i]) { ok = false; break; } }
        if (ok) { out.push([`${r},${c}`, `${r + dr * (w.length - 1)},${c + dc * (w.length - 1)}`]); break search; }
      }
    }
    return out;
  });
  for (const [i, [a, b]] of lines.entries()) {
    const [x1, y1] = await cellCenter(`[data-cell="${a}"]`); const [x2, y2] = await cellCenter(`[data-cell="${b}"]`);
    if (i % 2) { await page.mouse.click(x1, y1); await page.mouse.click(x2, y2); }
    else { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 6 }); await page.mouse.up(); }
    await page.waitForTimeout(150);
    if (i === 1) await shot('13h-wordsearch');
  }
  results.wordSearchSolved = lines.length === words && !!(await page.$('text=מצאת את כל המילים'));
  await shot('13i-wordsearch-done');
  await page.click('text=לגן החידות'); await page.click('text=לגן החידות');
  await page.click('text=תפזורת תרגילים'); await page.waitForTimeout(300);
  const exercises = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.ms-cell')];
    const n = Math.round(Math.sqrt(cells.length));
    const T = (r, c) => cells[r * n + c].textContent.replace('−', '-').replace('×', '*');
    const ok = (t) => { if (t.some((x) => x === '') || !/^\d+$/.test(t[0]) || !/^\d+$/.test(t[4])) return false; const e = [t[1], t[3]].filter((x) => x === '=').length; if (e !== 1) return false; const f = (a, o, b) => (o === '+' ? a + b : o === '-' ? a - b : a * b); const [a, o1, b, o2, c] = t; return o2 === '=' ? f(+a, o1, +b) === +c : +a === f(+b, o2, +c); };
    const out = [];
    for (let r = 0; r < n; r += 2) for (let c = 0; c + 4 < n; c += 2) if (ok([0, 1, 2, 3, 4].map((i) => T(r, c + i)))) out.push([`${r},${c}`, `${r},${c + 4}`]);
    for (let c = 0; c < n; c += 2) for (let r = 0; r + 4 < n; r += 2) if (ok([0, 1, 2, 3, 4].map((i) => T(r + i, c)))) out.push([`${r},${c}`, `${r + 4},${c}`]);
    return out;
  });
  for (const [i, [a, b]] of exercises.entries()) {
    const [x1, y1] = await cellCenter(`[data-cell="${a}"]`); const [x2, y2] = await cellCenter(`[data-cell="${b}"]`);
    await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(150);
    if (i === 1) await shot('13j-mathsearch');
  }
  results.mathSearchSolved = !!(await page.$('text=מצאת את כל התרגילים הנכונים'));
  await shot('13k-mathsearch-done');
  await page.click('text=לגן החידות'); await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
}
// bedtime story
if (await enter(-0.62, 'סיפור לילה')) {
  await shot('13d-story-lobby');
  await page.click('.story-tonight'); await page.waitForTimeout(300);
  await shot('13e-story-reader');
  await page.click('button:has-text("סיימתי לקרוא")'); await page.waitForTimeout(300);
  const opts = await page.$$('.story-q .choice:not([disabled])');
  for (const o of opts) { if (await page.$('.story-q .choice.right')) break; await o.click(); await page.waitForTimeout(100); }
  results.storyAnswered = !!(await page.$('.story-q .choice.right'));
  await page.screenshot({ path: `${OUT}/13f-story-goodnight.png`, fullPage: true });
  await page.click('text=לכל הפרקים'); await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
}
// parent
await page.click('[aria-label="אזור הורים"]');
const hold = await page.$('.hold'); const hb = await hold.boundingBox();
await page.mouse.move(hb.x + 20, hb.y + 10); await page.mouse.down(); await page.waitForTimeout(3300); await page.mouse.up();
await page.waitForSelector('text=הדוח של');
await page.screenshot({ path: `${OUT}/14-parent.png`, fullPage: true });
await page.click('text=חזרה למשחק'); await page.waitForTimeout(500);

// phone
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
await shot('15-phone-world');
console.log('RESULTS', JSON.stringify(results));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
const drifts = ['driftAfterRelease', 'driftAfterReleaseOutside', 'driftAfterPortalDrag', 'driftAfterKeyUp'].map((k) => Number(results[k]));
if (errors.length || drifts.some((d) => d > 0.1) || Number(results.joystickMoves) < 0.5 || !results.valuesRoundDone || !results.storyAnswered || !results.wordSearchSolved || !results.mathSearchSolved) {
  console.error('PLAYTEST FAILED', { drifts, errors });
  process.exit(1);
}
console.log('PLAYTEST PASSED');
