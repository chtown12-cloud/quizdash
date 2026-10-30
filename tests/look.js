// The front page wears a real theme from the first visit, and the host's
// chosen look (theme, colours, fonts) comes back after a reload
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  // Look & feel starts folded; open it when it isn't already
  const openLook = () => pg.evaluate(() => { document.querySelector('details.lookbox').open = true; });
  const state = () => pg.evaluate(() => ({ theme: document.documentElement.dataset.theme, scene: document.getElementById('scene').className, drawn: document.getElementById('scene').childElementCount,
    bg: getComputedStyle(document.body).backgroundColor, c2: getComputedStyle(document.documentElement).getPropertyValue('--c2').trim(), sel: document.getElementById('theme-sel').value,
    font: document.getElementById('font-display').value, hex1: document.getElementById('hex-1').value }));
  await pg.goto('http://localhost:8123/index.html'); await pg.waitForTimeout(600);
  let s = await state();
  ok(s.theme === 'classic' && s.scene === 'sc-classic' && s.drawn > 0 && !/79, 44, 189/.test(s.bg), `first visit: the front page wears Classic (${s.theme}, scene drawn, background ${s.bg}), not the old default purple`);
  // pick a theme in Look & feel, then come back later
  await pg.click('#btn-go-host'); await openLook();
  await pg.selectOption('#theme-sel', 'winter'); await pg.waitForTimeout(300);
  await pg.reload(); await pg.waitForTimeout(600);
  s = await state();
  ok(s.theme === 'winter' && s.scene === 'sc-winter' && s.sel === 'winter' && s.font === 'Fraunces', `after a reload the front page is still Winter Holidays, and Look & feel says so (${s.sel}, ${s.font})`);
  // a colour of your own comes back too
  await pg.click('#btn-go-host'); await openLook();
  await pg.fill('#hex-1', '#FF3366'); await pg.waitForTimeout(300);
  await pg.reload(); await pg.waitForTimeout(600);
  s = await state();
  ok(s.hex1 === '#FF3366' && s.c2.toUpperCase() === '#FF3366' && s.theme === 'winter', `your own accent colour comes back (${s.hex1}, page accent ${s.c2})`);
  // Surprise me
  await pg.click('#btn-go-host'); await openLook();
  await pg.click('#btn-random'); await pg.waitForTimeout(300);
  const surprise = await state();
  await pg.reload(); await pg.waitForTimeout(600);
  s = await state();
  ok(s.theme === surprise.theme && s.font === surprise.font && s.hex1 === surprise.hex1, `a Surprise me look comes back whole (${s.theme}, ${s.font}, ${s.hex1})`);
  // anything tampered with falls back to Classic
  await pg.evaluate(() => localStorage.setItem('qd-look', JSON.stringify({ theme: 'evil<script>', colors: ['javascript:alert(1)', 42], fonts: ['<b>x</b>', null] })));
  await pg.reload(); await pg.waitForTimeout(600);
  s = await state();
  ok(s.theme === 'classic' && s.sel === 'classic' && /^#[0-9A-F]{6}$/i.test(s.hex1) && s.font === 'Barlow Condensed', `a tampered saved look falls back to Classic (${s.theme}, ${s.font})`);
  await pg.evaluate(() => localStorage.setItem('qd-look', 'not json'));
  await pg.reload(); await pg.waitForTimeout(600);
  ok((await state()).theme === 'classic', 'unreadable saved look: Classic');
  // a player opening a join link on a fresh phone sees a real theme too
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await fresh.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const ph = await fresh.newPage(); ph.on('pageerror', e => errs.push('phone: ' + e.message));
  await ph.goto('http://localhost:8123/index.html?room=ABCD'); await ph.waitForTimeout(600);
  const p = await ph.evaluate(() => ({ theme: document.documentElement.dataset.theme, join: document.getElementById('s-join').classList.contains('active') }));
  ok(p.theme === 'classic' && p.join, 'a join link on a fresh phone: the join screen, in Classic');
  console.log('ERRORS', errs);
  await browser.close();
})();
