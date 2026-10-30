// Moving scenery never crosses the question (passing behind the answers is
// fine). Every animation in the scene is stepped through its whole cycle
// (reveal-only ones too, wherever a reveal can happen), and anything that
// travels (a satellite, shooting stars, a rocket, bubbles, a whale, a
// witch, clouds) is checked against the question's lines of text, on the
// big screen at several sizes and on phones.
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const MOVERS = '.sc-sat, .sc-shoot, .sc-rocket, .sc-burst i, .sc-whale, .sc-witch, .sc-cloud';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  const THEMES = await host.evaluate(() => THEMES);
  const map = await host.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 1100; const g = c.getContext('2d'); g.fillStyle = '#cfe6f5'; g.fillRect(0, 0, 900, 1100); g.fillStyle = '#e8dcc0'; g.fillRect(80, 60, 700, 900); return c.toDataURL('image/jpeg', .8); });
  const Q = "Here's a picture of New England in the USA. Where is Salem, Massachusetts?";
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', `# Movers | 120s | read 0s\n\n## ${Q} | read 30s\n- Here\n- There *\n- Nowhere\n- Everywhere\n\n## ${Q}\n![](${map})\n= 72%, 66% ± 6%\n`);
  await host.waitForTimeout(400);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  const phone = await ctx.newPage(); await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto('http://localhost:8123/index.html?room=' + await host.textContent('#hlobby-code'));
  await phone.fill('#join-name', 'Pat'); await phone.click('#btn-join'); await phone.waitForSelector('#s-plobby.active');
  await host.bringToFront(); await host.click('#btn-start');
  // In the page: step every scene animation through 120 points of its
  // cycle, at rest and during a reveal, and report any travelling piece of
  // scenery whose box meets a line of the question
  const sweep = (pg, textSel, flares) => pg.evaluate(([textSel, MOVERS, flares]) => {
    const range = document.createRange(); range.selectNodeContents(document.querySelector(textSel));
    const lines = [...range.getClientRects()].filter(r => r.width > 4).map(r => ({ l: r.left - 6, r: r.right + 6, t: r.top - 6, b: r.bottom + 6 }));
    const hits = new Set();
    for (const flare of flares){
      document.documentElement.classList.toggle('flare', flare);
      const anims = document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#scene'));
      anims.forEach(a => a.pause());
      for (let k = 0; k <= 120; k++){
        for (const a of anims){ const t = a.effect.getComputedTiming(); const d = t.activeDuration === Infinity ? t.duration : t.activeDuration; if (d) a.currentTime = (t.delay > 0 ? t.delay : 0) + d * k / 120; }
        for (const el of document.querySelectorAll('#scene :is(' + MOVERS + ')')){
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < .05) continue;
          const b = el.getBoundingClientRect();
          if (!b.width) continue;
          if (lines.some(x => b.left < x.r && b.right > x.l && b.top < x.b && b.bottom > x.t)) hits.add((el.getAttribute('class') || el.parentElement.getAttribute('class') + ' bubble') + (flare ? ' (reveal)' : ''));
        }
      }
      anims.forEach(a => a.play());
    }
    document.documentElement.classList.remove('flare');
    return [...hits];
  }, [textSel, MOVERS, flares]);
  const run = async (pg, sel, label, sizes, flares = [false, true]) => {
    await pg.bringToFront();
    for (const [w, h] of sizes){
      await pg.setViewportSize({ width: w, height: h }); await pg.waitForTimeout(250);
      if (pg === host) await host.evaluate(() => typeof fitHost === 'function' && fitHost());
      for (const t of THEMES){
        await pg.evaluate(t => applyLook(THEME_COLORS[t], t), t); await pg.waitForTimeout(100);
        const hits = await sweep(pg, sel, flares);
        ok(!hits.length, `${label} ${w}x${h} ${t}: nothing moving crosses the question${hits.length ? ' — ' + hits.join(', ') : ''}`);
      }
    }
  };
  // while everyone reads (the question big and centred; no reveal comes
  // before the answers are up)…
  await phone.waitForSelector('#s-pquestion.active.reading');
  await run(host, '#hq-text', 'reading', [[1000, 600], [1280, 720], [1920, 1080]], [false]);
  await run(phone, '#pq-text', 'phone reading', [[390, 844]], [false]);
  await host.bringToFront(); await host.setViewportSize({ width: 1280, height: 720 });
  await host.click('#btn-hq-skip');
  // …while answering…
  await phone.waitForSelector('#pq-answers .answer'); await host.waitForTimeout(800);
  await run(host, '#hq-text', 'answering', [[1000, 600], [1280, 720], [1366, 680]]);
  await run(phone, '#pq-text', 'phone answering', [[390, 844], [360, 640]]);
  await host.bringToFront(); await host.setViewportSize({ width: 1280, height: 720 });
  await host.click('#btn-hq-skip'); await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 20000 });
  // …at the reveal…
  await host.waitForTimeout(500);
  await run(host, '#hq-text', 'revealed', [[1000, 600], [1280, 720], [1920, 1080]]);
  await host.setViewportSize({ width: 1280, height: 720 }); await host.click('#btn-hq-next'); await host.waitForTimeout(600);
  if (await host.$('#s-hboard.active')){ await host.waitForTimeout(700); await host.click('#btn-hb-next'); }
  // …and with a big picture, where the question sits near the top
  await host.waitForSelector('#hq-answers .bighint'); await host.waitForFunction(() => !document.getElementById('hq-img').hidden); await host.waitForTimeout(600);
  await run(host, '#hq-text', 'picture', [[1000, 600], [968, 720], [1280, 720], [1920, 1080]]);
  console.log('ERRORS', errs);
  await browser.close();
})();
