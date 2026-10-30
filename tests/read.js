// Phone reading screen: with no picture the question is the big thing; the
// countdown stays put across phases; hidden pictures draw nothing
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const OUT = __dirname + '/out';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  const THEMES = await host.evaluate(() => THEMES);
  const img = await host.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 500; const g = c.getContext('2d'); g.fillStyle = '#c96'; g.fillRect(0, 0, 800, 500); g.fillStyle = '#345'; g.fillRect(200, 120, 400, 260); return c.toDataURL('image/png'); });
  const LONG = 'Which of these famous landmarks, built over many decades by thousands of workers and finished long after its original architect died, is still officially unfinished today?';
  const MD = `# Read | 30s | read 30s\n\n## What is the name of the temporary altar at Dia de los Muertos celebrations?\n- Altar\n- Ofrenda *\n- Mesilla\n- Culito\n\n## ${LONG}\n- Sagrada Familia *\n- Eiffel Tower\n- Big Ben\n- Taj Mahal\n\n## What is this?\n![](${img})\n- A box *\n- A cat\n`;
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', MD); await host.waitForTimeout(500);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  const code = await host.textContent('#hlobby-code');
  const pat = await ctx.newPage(); pat.on('pageerror', e => errs.push('pat: ' + e.message));
  await pat.setViewportSize({ width: 390, height: 844 });
  await pat.goto('http://localhost:8123/index.html?room=' + code);
  await pat.fill('#join-name', 'Pat'); await pat.click('#btn-join'); await pat.waitForSelector('#s-plobby.active');
  const look = async (pg, t) => { await pg.evaluate(t => applyLook(THEME_COLORS[t], t), t); await pg.waitForTimeout(650); };
  const m = () => pat.evaluate(() => {
    const r = id => document.getElementById(id).getBoundingClientRect();
    const vis = id => { const e = document.getElementById(id); return !!e.offsetParent && getComputedStyle(e).display !== 'none'; };
    const ghost = [...document.querySelectorAll('img.qimg[hidden]')].filter(i => { const b = i.getBoundingClientRect(); return b.width || b.height; }).length;
    return { fs: parseFloat(getComputedStyle(document.getElementById('pq-text')).fontSize), timerTop: Math.round(r('pq-timer').top), textBottom: r('pq-text').bottom,
      cueTop: r('pq-locked-sub').top, mark: vis('pq-locked-mark'), title: vis('pq-locked-title'), cue: vis('pq-locked-sub'), pic: vis('pq-img'),
      ghost, fits: document.scrollingElement.scrollHeight <= innerHeight + 1 };
  });
  const next = async () => { await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 25000 }); await host.waitForTimeout(500); await host.click('#btn-hq-next'); await host.waitForTimeout(500); if (await host.$('#s-hboard.active')){ await host.waitForTimeout(600); await host.click('#btn-hb-next'); } };
  await host.click('#btn-start');

  // Q1, reading
  await pat.waitForSelector('#s-pquestion.active.reading');
  const tops = {};
  for (const t of THEMES){
    await look(pat, t); const x = await m(); tops[t] = x.timerTop;
    ok(x.fs >= 28 && !x.mark && !x.title && x.cue && x.cueTop - x.textBottom < 40 && x.ghost === 0 && x.fits,
      `${t} reading: question ${x.fs}px, eye and title gone, cue right under it (${Math.round(x.cueTop - x.textBottom)}px), no ghost frame, fits`);
    await pat.screenshot({ path: `${OUT}/read-${t}.png` });
  }
  ok(await host.evaluate(() => { const b = document.getElementById('hq-img').getBoundingClientRect(); return !b.width && !b.height; }), 'big screen: no picture, no frame');
  await host.click('#btn-hq-skip');
  await pat.waitForSelector('#pq-answers button.answer');
  await pat.waitForTimeout(700);
  for (const t of THEMES){
    await look(pat, t); const x = await m();
    ok(x.fs >= 20.5 && Math.abs(x.timerTop - tops[t]) <= 2 && x.ghost === 0 && x.fits, `${t} answering: question ${x.fs}px, timer stays at ${x.timerTop} (reading ${tops[t]}), fits`);
    await pat.screenshot({ path: `${OUT}/answer-${t}.png` });
  }
  ok(await host.evaluate(() => { const b = document.getElementById('hq-img').getBoundingClientRect(); return !b.width && !b.height; }), 'big screen answering: no picture, no frame');
  await host.screenshot({ path: `${OUT}/host-answering.png` });
  await look(pat, 'classic');
  await pat.click('#pq-answers button.answer >> text=Ofrenda');
  await pat.waitForSelector('#pq-locked', { state: 'visible' });
  const s = await m();
  ok(Math.abs(s.timerTop - tops.classic) <= 2 && s.mark && s.title, `waiting for the reveal: timer still at ${s.timerTop}, the drumroll mark and line are back`);
  await pat.screenshot({ path: `${OUT}/suspense-classic.png` });
  await next();

  // Q2, long question, reading: still fits in every theme
  await pat.waitForSelector('#s-pquestion.active.reading');
  for (const t of THEMES){
    await look(pat, t); const x = await m();
    ok(x.fs >= 22 && x.fits, `${t} long question reading: ${x.fs}px and fits`);
    if (['classic', 'brutalist', 'editorial', 'spooky'].includes(t)) await pat.screenshot({ path: `${OUT}/readlong-${t}.png` });
  }
  await host.click('#btn-hq-skip');
  await pat.waitForSelector('#pq-answers button.answer');
  for (const t of ['classic', 'brutalist']){ await look(pat, t); const x = await m(); ok(x.fits, `${t} long question answering fits`); await pat.screenshot({ path: `${OUT}/answerlong-${t}.png` }); }
  await pat.click('#pq-answers button.answer >> text=Sagrada');
  await next();

  // Q3, picture: the picture shows and the question keeps the smaller size
  await pat.waitForSelector('#s-pquestion.active.reading');
  await pat.waitForFunction(() => !document.getElementById('pq-img').hidden);
  for (const t of ['classic', 'spooky', 'doodle']){
    await look(pat, t); const x = await m();
    ok(x.pic && x.fs <= 27.5 && !x.mark && x.cue && x.fits, `${t} picture reading: picture shows, question ${x.fs}px, cue under it, fits`);
    await pat.screenshot({ path: `${OUT}/readpic-${t}.png` });
  }
  console.log('ERRORS', errs);
  await browser.close();
})();
