// Text contrast in every theme: real text against the real background it
// sits on, on the landing page, lobby, question, reveal, leaderboard and a
// phone. 4.5:1 for body text, 3:1 for large headings (WCAG AA).
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  const THEMES = ONLY || await host.evaluate(() => THEMES);
  // In the page: each element's text colour against the colour actually
  // behind it (translucent layers composited down to the stage), with
  // opacity and a brightness filter applied to both.
  const measure = (pg, sels) => pg.evaluate(sels => {
    const parse = c => {
      let m = c.match(/^rgba?\(([^)]+)\)/);
      if (m){ const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
      m = c.match(/^color\(srgb ([^)]+)\)/);
      if (m){ const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
      return null;
    };
    const over = (top, bot) => { const a = top[3]; return [0, 1, 2].map(i => top[i] * a + bot[i] * (1 - a)).concat(1); };
    const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const stage = parse(getComputedStyle(document.body).backgroundColor) || [0, 0, 0, 1];
    const bgOf = el => {
      const layers = [];
      for (let n = el; n && n !== document.body; n = n.parentElement){ const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0){ layers.push(c); if (c[3] >= 1) break; } }
      let bg = stage.slice();
      for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
      return bg;
    };
    const out = [];
    // entrance animations (they restart when a theme changes) are finished
    // first, so a half-faded tile is never what gets measured
    for (const a of document.getAnimations()) if (a.effect && a.effect.getComputedTiming().endTime !== Infinity) a.finish();
    for (const sel of sels) for (const el of document.querySelectorAll(sel)){
      if (!el.offsetParent || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      let fg = parse(cs.color), bg = bgOf(el);
      if (!fg) continue;
      fg = over(fg, bg);
      // opacity fades text and box together towards whatever is behind the box
      let op = 1; for (let n = el; n && n !== document.body; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      const behind = el.parentElement ? bgOf(el.parentElement) : stage;
      if (op < 1){ fg = over([...fg.slice(0, 3), op], behind); bg = over([...bg.slice(0, 3), op], behind); }
      const br = (cs.filter.match(/brightness\(([\d.]+)\)/) || [, 1])[1];
      if (br != 1){ fg = fg.map((v, i) => i < 3 ? v * br : v); bg = bg.map((v, i) => i < 3 ? v * br : v); }
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      out.push({ sel, text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24), r: Math.round(ratio(fg, bg) * 100) / 100, need });
    }
    return out;
  }, sels);
  const look = async (pg, t) => { await pg.evaluate(t => applyLook(THEME_COLORS[t], t), t); await pg.waitForTimeout(150); };
  const check = async (pg, screen, sels) => {
    await pg.bringToFront();
    for (const t of THEMES){
      await look(pg, t);
      const rs = await measure(pg, sels);
      const bad = rs.filter(x => x.r < x.need);
      const worst = rs.reduce((a, b) => (b.r / b.need < a.r / a.need ? b : a), rs[0] || { r: 0, need: 1, sel: 'nothing measured' });
      ok(rs.length && !bad.length, `${screen} ${t}: ${rs.length} texts, lowest ${worst.r}:1 (${worst.sel} "${worst.text}", needs ${worst.need})${bad.length ? ' — ' + bad.slice(0, 4).map(b => `${b.sel} "${b.text}" ${b.r}`).join('; ') : ''}`);
    }
  };
  await host.waitForTimeout(800);
  await check(host, 'landing', ['.steps li', '.hero', 'p.lede', '.badge-online']);
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', `# Contrast | 60s | read 0s\n\n## Which planet is known as the Red Planet?\n- Venus\n- Mars *\n- Jupiter\n- Saturn\n\n## Second?\n- A *\n- B\n`);
  await host.waitForTimeout(400);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  const phone = await ctx.newPage(); await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto('http://localhost:8123/index.html?room=' + await host.textContent('#hlobby-code'));
  await phone.fill('#join-name', 'Pat'); await phone.click('#btn-join'); await phone.waitForSelector('#s-plobby.active');
  await host.click('[data-bots="10"]'); await host.waitForTimeout(800);
  await host.bringToFront();
  await check(host, 'lobby', ['#s-hlobby .roomcode', '#s-hlobby .chip', '#s-hlobby .count-badge', '#hlobby-title']);
  await host.click('#btn-start');
  await phone.waitForSelector('#pq-answers .answer'); await host.waitForTimeout(900);
  await check(host, 'question', ['#hq-text', '#hq-answers .answer', '#s-hquestion .pill', '#hq-timer']);
  await check(phone, 'phone question', ['#pq-text', '#pq-answers .answer', '#s-pquestion .pill']);
  await phone.click('#pq-answers .answer >> text=Mars');
  await host.click('#btn-hq-skip'); await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 20000 }); await host.waitForTimeout(1900);
  await host.bringToFront();
  await check(host, 'reveal', ['#hq-reveal .ansbig-t', '#hq-reveal .ansbig-sub', '#hq-answers .answer']);
  await phone.waitForSelector('#s-presult.active'); await phone.waitForTimeout(800);
  await check(phone, 'phone result', ['#pr-body h1', '#pr-body .anschip', '#pr-body .points-pop']);
  await host.click('#btn-hq-next'); await host.waitForSelector('#s-hboard.active'); await host.waitForTimeout(2600);
  await check(host, 'leaderboard', ['#s-hboard .boardrow', '#s-hboard h1, #s-hboard h2']);
  console.log('ERRORS', errs);
  await browser.close();
})();
