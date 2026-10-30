// The front page wears a real theme from the first visit, the host's
// chosen look (theme, colours, fonts) comes back after a reload, and
// whatever colours a theme is given, its words still read
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
  // Surprise me pairs a dark palette with any theme; a pale theme keeps a
  // pale page (tinted by the colour) and the front page's words still read
  const words = () => pg.evaluate(() => {
    const parse = c => {
      let m = c.match(/^rgba?\(([^)]+)\)/);
      if (m){ const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
      m = c.match(/^color\(srgb ([^)]+)\)/);
      const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
    };
    const over = (top, bot, a = top[3]) => [0, 1, 2].map(i => top[i] * a + bot[i] * (1 - a));
    const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const stage = parse(getComputedStyle(document.body).backgroundColor);
    // text colour and opacity, both laid over the stage
    return Math.min(...['.hero', '#s-landing p.muted'].map(q => { const el = document.querySelector(q), cs = getComputedStyle(el); return ratio(over(over(parse(cs.color), stage), stage, Number(cs.opacity)), stage); }));
  });
  const seen = new Set(); let worst = 99, worstAt = '', notes = 0, notesRight = true;
  await pg.click('#btn-go-host'); await openLook();
  for (let i = 0; i < 30; i++){
    await pg.click('#btn-random'); await pg.waitForTimeout(60);
    const r = await pg.evaluate(() => ({ t: $('theme-sel').value, picked: readColorInputs()[0], stage: getComputedStyle(document.documentElement).getPropertyValue('--c1').trim(), note: !$('col-fit').hidden }));
    seen.add(r.t);
    await pg.evaluate(() => show('s-landing')); await pg.waitForTimeout(60);
    const w = await words(); if (w < worst){ worst = w; worstAt = `${r.t} ${r.picked}`; }
    const moved = r.stage.toUpperCase() !== r.picked.toUpperCase();
    if (moved) notes++;
    if (r.note !== moved) notesRight = false;
    await pg.click('#btn-go-host');
  }
  ok(worst >= 4.5, `30 presses of Surprise me (${seen.size} themes): the front page's words always read (lowest ${worst.toFixed(2)}:1, ${worstAt})`);
  ok(notesRight && notes > 0, `Look & feel says so exactly when a theme tints the background instead (${notes} of 30)`);
  // …and every pairing Surprise me can make, not just the ones it happened to
  let all = 99, allAt = '';
  for (const [t, pal] of await pg.evaluate(() => THEMES.flatMap(t => PALETTES.map(p => [t, p])))){
    await pg.evaluate(([t, pal]) => applyLook(pal, t), [t, pal]);
    const w = await words(); if (w < all){ all = w; allAt = `${t} ${pal[0]}`; }
  }
  ok(all >= 4.5, `every curated palette in every theme: the front page's words read (lowest ${all.toFixed(2)}:1, ${allAt})`);
  await pg.evaluate(() => localStorage.setItem('qd-look', JSON.stringify({ theme: 'doodle', colors: ['#03045E', '#FFD60A', '#F72585', '#00F5D4'], fonts: ['Kalam', 'Nunito'] })));
  await pg.reload(); await pg.waitForTimeout(600);
  const navy = await words();
  ok(navy >= 4.5, `a saved navy Doodle reads on the front page (${navy.toFixed(2)}:1)`);
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
