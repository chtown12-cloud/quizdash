// Themes painted on a canvas (see Living in index.html): what the scene
// paints behind the question must leave it readable. The contrast test
// only sees CSS colours, so here the canvas itself is read back under
// each line of the question, at several moments and at the height of a
// reveal, and the question's colour is compared with the brightest (or,
// for dark text, darkest) tenth of what lies behind it. Needs 4.5:1.
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  const THEMES = await host.evaluate(() => THEMES.filter(t => LIVE[t]));
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', `# Behind | 120s | read 0s\n\n## Here's a picture of New England in the USA. Where is Salem, Massachusetts?\n- Here\n- There *\n- Nowhere\n- Everywhere\n`);
  await host.waitForTimeout(400);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  const phone = await ctx.newPage(); await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto('http://localhost:8123/index.html?room=' + await host.textContent('#hlobby-code'));
  await phone.fill('#join-name', 'Pat'); await phone.click('#btn-join'); await phone.waitForSelector('#s-plobby.active');
  await host.bringToFront(); await host.click('#btn-start');
  await phone.waitForSelector('#pq-answers .answer'); await host.waitForTimeout(900);
  // In the page: the lowest contrast between the text and the tenth of the
  // canvas behind it that is closest to it in brightness
  const measure = (pg, sel) => pg.evaluate(sel => {
    const w = Living.w, el = document.querySelector(sel);
    const lum = (r, g, b) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const m = getComputedStyle(el).color.match(/[\d.]+/g).map(Number), text = lum(m[0], m[1], m[2]);
    const range = document.createRange(); range.selectNodeContents(el);
    const lines = [...range.getClientRects()].filter(r => r.width > 4);
    Living.pause();
    let worst = 99;
    const look = () => {
      for (const r of lines){
        const d = w.ctx.getImageData(Math.round(r.left * w.dpr), Math.round(r.top * w.dpr), Math.round(r.width * w.dpr), Math.round(r.height * w.dpr)).data, ls = [];
        for (let i = 0; i < d.length; i += 16) ls.push(lum(d[i], d[i + 1], d[i + 2]));
        ls.sort((a, b) => a - b);
        const near = text > .5 ? ls[Math.floor(ls.length * .9)] : ls[Math.floor(ls.length * .1)];
        worst = Math.min(worst, (Math.max(text, near) + .05) / (Math.min(text, near) + .05));
      }
    };
    for (let k = 0; k < 10; k++){ for (let i = 0; i < 90; i++) Living.step(1 / 30); w.mod.draw(w); look(); }
    // the height of a reveal
    w.mod.flare(w);
    for (let k = 0; k < 6; k++){ for (let i = 0; i < 4; i++) Living.step(1 / 30); w.mod.draw(w); look(); }
    Living.play();
    return Math.round(worst * 100) / 100;
  }, sel);
  for (const [pg, sel, label] of [[host, '#hq-text', 'big screen'], [phone, '#pq-text', 'phone']]){
    await pg.bringToFront();
    for (const t of THEMES){
      await pg.evaluate(t => applyLook(THEME_COLORS[t], t), t); await pg.waitForTimeout(250);
      const r = await measure(pg, sel);
      ok(r >= 4.5, `${label} ${t}: the question reads over the painted scene, at rest and at a reveal (lowest ${r}:1)`);
    }
  }
  console.log('ERRORS', errs);
  await browser.close();
})();
