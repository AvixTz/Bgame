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
await page.waitForTimeout(1500);
let p1 = await pos();
results.joystickMoves = dist(p0, p1).toFixed(2);
await shot('01-joystick-drag');
await page.mouse.up();
await page.waitForTimeout(400);
let p2 = await pos();
await page.waitForTimeout(2000);
let p3 = await pos();
results.driftAfterRelease = dist(p2, p3).toFixed(3);

// release outside the joystick zone (finger slides off)
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx + 40, cy - 30, { steps: 4 });
await page.waitForTimeout(600);
await page.mouse.move(800, 200, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(400);
p2 = await pos(); await page.waitForTimeout(1500); p3 = await pos();
results.driftAfterReleaseOutside = dist(p2, p3).toFixed(3);

// drag while walking into a portal zone, then release (old bug: joystick unmounted mid-drag)
await page.evaluate(() => { const a = Math.PI - 0.6; window.__teleport = [Math.sin(a) * 11.2, Math.cos(a) * 11.2]; });
await page.waitForTimeout(800);
await page.mouse.move(cx, cy); await page.mouse.down();
await page.mouse.move(cx, cy - 40, { steps: 4 });
await page.waitForTimeout(900);
await shot('02-drag-into-portal');
await page.mouse.up();
await page.waitForTimeout(400);
p2 = await pos(); await page.waitForTimeout(1500); p3 = await pos();
results.driftAfterPortalDrag = dist(p2, p3).toFixed(3);

// keyboard
p0 = await pos();
await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowDown');
await page.waitForTimeout(400); p2 = await pos(); await page.waitForTimeout(1500); p3 = await pos();
results.keyboardMoves = dist(p0, p2).toFixed(2);
results.driftAfterKeyUp = dist(p2, p3).toFixed(3);
console.log('MOVEMENT', JSON.stringify(results));

const enter = async (angle, label) => {
  await page.evaluate((a) => { window.__teleport = [Math.sin(a) * 10.8, Math.cos(a) * 10.8]; }, angle);
  await page.waitForTimeout(1200);
  const btn = await page.$(`text=כניסה ל${label}`);
  if (!btn) { console.log('NO PORTAL BUTTON', label); await shot('portal-missing-' + label); return false; }
  await btn.click(); await page.waitForTimeout(500); return true;
};
const answerChoices = async (n, prefix) => {
  for (let i = 0; i < n * 4 + 4; i++) {
    if (await page.$('text=המסע של היום הושלם')) break;
    const cont = await page.$('text=המשך ←');
    if (cont) { await cont.click(); await page.waitForTimeout(150); continue; }
    const ch = await page.$$('.choice:not([disabled])');
    if (!ch.length) { await page.waitForTimeout(200); continue; }
    if (i === 1) await shot(prefix + '-question');
    await ch[0].click(); await page.click('button:has-text("✓ בד")'); await page.waitForTimeout(200);
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
if (await enter(0.35, 'ארנה החשיבה')) {
  await shot('07-arena');
  await page.click('text=איקס עיגול'); await page.waitForTimeout(300);
  for (let k = 0; k < 6; k++) {
    if (await page.$('text=עוד משחק')) break;
    const cells = await page.$$('.ttt-cell');
    for (const c of cells) { if (!(await c.textContent()).trim()) { await c.click(); break; } }
    await page.waitForTimeout(700);
  }
  await page.click('text=💡 רמז').catch(() => {});
  await shot('08-ttt');
  await page.click('text=← לזירה');
  await page.click('text=ארבע בשורה'); await page.waitForTimeout(300);
  for (let k = 0; k < 4; k++) { await page.click(`.c4-cell >> nth=${38 - k % 2}`); await page.waitForTimeout(700); }
  await page.click('text=💡 רמז').catch(() => {});
  await shot('09-c4');
  await page.click('text=← לזירה');
  await page.click('text=מגדלי האנוי'); await page.waitForTimeout(300);
  for (let k = 0; k < 7; k++) {
    await page.click('text=💡 רמז');
    const from = await page.$('.peg.hint-from'); const to = await page.$('.peg.hint-to');
    if (!from || !to) break;
    await from.click(); await to.click(); await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  await shot('10-hanoi');
  await page.click('text=← לזירה'); await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
}
// village
if (await enter(-1.75, 'כפר החברים')) {
  await shot('11-village');
  await page.click('.tunnel >> nth=0'); await page.waitForTimeout(300);
  await page.click('.choice >> nth=1'); await page.waitForTimeout(200);
  await shot('12-village-outcome');
  await page.click('text=סיימתי'); await page.waitForTimeout(200);
  await shot('13-village-reflect');
  await page.click('text=חזרה לכפר'); await page.click('text=חזרה לאי'); await page.waitForTimeout(800);
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
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
const drifts = ['driftAfterRelease', 'driftAfterReleaseOutside', 'driftAfterPortalDrag', 'driftAfterKeyUp'].map((k) => Number(results[k]));
if (errors.length || drifts.some((d) => d > 0.1) || Number(results.joystickMoves) < 0.5) {
  console.error('PLAYTEST FAILED', { drifts, errors });
  process.exit(1);
}
console.log('PLAYTEST PASSED');
