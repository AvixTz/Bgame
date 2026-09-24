// Responsive audit: visits the main screens at phone/tablet/desktop sizes (portrait and landscape),
// saves screenshots and fails on horizontal overflow or controls that fall outside the viewport.
// Usage: npm run build && npx vite preview --port 4173 & node tests/e2e/responsive.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.env.PLAYTEST_OUT ?? 'playtest-shots';
const BASE = process.env.PLAYTEST_URL ?? 'http://localhost:4173/';
mkdirSync(`${OUT}/responsive`, { recursive: true });

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 740, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true },
  { name: 'phone-landscape', width: 844, height: 390, touch: true },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const errors = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${vp.name}: ${e.message}`));
  const shot = (n) => page.screenshot({ path: `${OUT}/responsive/${vp.name}-${n}.png` });
  const check = async (where) => {
    const r = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth - w;
      const out = [...document.querySelectorAll('button, .choice, input')]
        .filter((el) => el.offsetParent !== null && !el.closest('.night-sky'))
        .map((el) => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24), r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.left < -2 || r.right > w + 2))
        .map(({ t, r }) => `${t} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      return { over, out };
    });
    if (r.over > 1) problems.push(`${vp.name} ${where}: page is ${r.over}px wider than the screen`);
    if (r.out.length) problems.push(`${vp.name} ${where}: controls outside the screen: ${r.out.join(', ')}`);
  };
  const click = (sel) => (vp.touch ? page.tap(sel) : page.click(sel));
  const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const enter = async (angle, label) => {
    await page.evaluate((a) => { window.__teleport = [Math.sin(a) * 10.8, Math.cos(a) * 10.8]; }, angle);
    await frames(5);
    const btn = await page.waitForSelector(`text=כניסה ל${label}`, { timeout: 8000 }).catch(() => null);
    if (!btn) { problems.push(`${vp.name}: no portal button for ${label}`); return false; }
    await btn.click(); await page.waitForTimeout(900); return true;
  };
  const home = async () => {
    const quit = await page.$('button:has-text("יציאה")');
    if (quit) { await quit.click(); await page.waitForTimeout(300); }
    await page.click('text=חזרה לאי'); await page.waitForTimeout(900);
  };

  await page.goto(BASE);
  await page.waitForSelector('text=שחקן חדש');
  await check('profiles'); await shot('01-profiles');
  await page.fill('input.input', 'נועה'); await page.click('text=בת'); await page.click("text=כיתה ג'");
  await page.click('text=יוצאים לדרך!');
  await page.waitForSelector('canvas'); await page.waitForTimeout(2000);
  await check('world'); await shot('02-world');

  if (await enter(Math.PI - 0.6, 'מכרות המספרים')) {
    await check('math lobby'); await shot('03-math-lobby');
    await page.click('button:has-text("מסע היכרות")'); await page.waitForTimeout(600);
    await page.waitForSelector("text=למסע הראשון", { timeout: 3000 }).then((b) => b.click()).catch(() => {}); await page.waitForTimeout(600);
    await check('math question'); await shot('04-math-question');
    await home();
  }
  if (await enter(-1.75, 'כפר החברים')) {
    await check('village'); await shot('05-village');
    await page.click('button:has-text("סבב")'); await page.waitForTimeout(300);
    await page.click('.values-q .choice >> nth=0'); await page.waitForTimeout(300);
    await check('values question'); await shot('06-values');
    await page.click('text=לכפר'); await home();
  }
  if (await enter(-0.62, 'סיפור לילה')) {
    await check('story lobby'); await shot('07-story-lobby');
    await page.click('.story-tonight'); await page.waitForTimeout(300);
    await check('story reader'); await shot('08-story-reader');
    await page.click('text=לכל הפרקים'); await home();
  }
  if (await enter(0.5, 'ארנה החשיבה')) {
    await page.click('text=ארבע בשורה'); await page.waitForTimeout(300);
    await check('connect four'); await shot('09-c4');
    await page.click('button:has-text("לזירה")'); await home();
  }
  await ctx.close();
}
await browser.close();
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'RESPONSIVE OK');
process.exit(problems.length || errors.length ? 1 : 0);
