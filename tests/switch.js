// Multiple choice: a pick locks in with its time, a switch replaces it at the
// later time, and answering still closes the moment everyone has picked
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  const MD = `# Switch | 12s | read 0s\n\n## Which planet is red?\n- Venus\n- Mars *\n- Pluto\n- Earth\n\n## Pick the fruit\n- Apple *\n- Brick\n- Chair\n\n## Favourite colour? | poll\n- Red\n- Blue\n- Green\n`;
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', MD); await host.waitForTimeout(500);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  const code = await host.textContent('#hlobby-code');
  const join = async name => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); await p.setViewportSize({ width: 390, height: 844 }); await p.goto('http://localhost:8123/index.html?room=' + code); await p.fill('#join-name', name); await p.click('#btn-join'); await p.waitForSelector('#s-plobby.active'); return p; };
  const pat = await join('Pat'), sam = await join('Sam');
  const patId = await pat.evaluate(c => sessionStorage.getItem('qd-pid-' + c), code);
  const stored = q => host.evaluate(([c, q, id]) => Sync.get(`rooms/${c}/answers/${q}/${id}`), [code, q, patId]);
  const result = async p => { await p.waitForSelector('#s-presult.active', { timeout: 25000 }); await p.waitForTimeout(400); return (await p.textContent('#pr-body')).replace(/\s+/g, ' ').trim(); };
  const pts = t => Number((t.match(/\+([\d,]+)/) || [, '0'])[1].replace(/,/g, ''));
  const tile = (p, text) => p.$(`#pq-answers button.answer:has-text("${text}")`);
  const tap = async (p, text) => { const b = await (await tile(p, text)).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  const until = async (t0, ms) => { while (Date.now() - t0 < ms) await host.waitForTimeout(50); };
  const next = async () => { await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 25000 }); await host.waitForTimeout(500); await host.click('#btn-hq-next'); await host.waitForTimeout(500); if (await host.$('#s-hboard.active')){ await host.waitForTimeout(600); await host.click('#btn-hb-next'); } };
  const marks = p => p.$$eval('#pq-answers button.answer', bs => bs.map(b => ({ t: b.textContent.trim(), picked: b.classList.contains('picked'), check: !!b.querySelector('.shape svg.ic') })));
  await host.click('#btn-start');

  // Q1: Pat picks Venus at ~1s, switches to Mars at ~4s, taps Mars again at ~5s; Sam picks Mars at ~6s
  await pat.waitForSelector('#pq-answers button.answer'); await sam.waitForSelector('#pq-answers button.answer');
  const t0 = Date.now();
  await until(t0, 1000);
  const before = await (await tile(pat, 'Mars')).boundingBox();   // after the tiles' entrance animation
  await tap(pat, 'Venus');
  await pat.waitForTimeout(300);
  let a = await stored(0);
  ok(a && a.c === 0 && a.e < 2, `first pick saved at once: Venus at ${a && a.e}s`);
  ok(await pat.isVisible('#pq-answers button.answer') && !(await pat.isVisible('#pq-locked')), 'the tiles stay up after a pick');
  const after = await (await tile(pat, 'Mars')).boundingBox();
  ok(Math.abs(after.y - before.y) < 1, `the tiles don't move when the note appears (${before.y} → ${after.y})`);
  ok(await pat.$eval('#pq-pick-note', n => getComputedStyle(n).visibility === 'visible' && n.getBoundingClientRect().bottom <= document.querySelector('#pq-answers').getBoundingClientRect().top), 'the note shows above the tiles');
  const note = (await pat.textContent('#pq-pick-note')).trim();
  ok(/Locked in\. You can still switch/.test(note), 'note: ' + note);
  await until(t0, 4000); await tap(pat, 'Mars');
  await pat.waitForTimeout(300);
  a = await stored(0);
  ok(a && a.c === 1 && a.e >= 3.5 && a.e < 5, `switch replaces it, at the later time: Mars at ${a && a.e}s`);
  const m = await marks(pat);
  ok(m.filter(x => x.picked).map(x => x.t).join() === 'Mars' && m.find(x => x.t === 'Mars').check && !m.find(x => x.t === 'Venus').check, 'the mark and check moved to Mars, Venus has its shape back');
  await until(t0, 5000); await tap(pat, 'Mars');
  await pat.waitForTimeout(300);
  const a2 = await stored(0);
  ok(a2 && a2.e === a.e, `tapping Mars again keeps its time (${a2 && a2.e}s)`);
  ok(await host.evaluate(() => document.getElementById('hq-answered').textContent === '1' && !document.getElementById('btn-hq-next').offsetParent), 'big screen: 1 answered, still open');
  await until(t0, 6000); await tap(sam, 'Mars');
  const tSam = Date.now();
  await sam.waitForSelector('#pq-locked', { state: 'visible', timeout: 5000 });
  const closeMs = Date.now() - tSam;
  ok(closeMs < 1500, `everyone has picked, so answering closes right away (${closeMs}ms)`);
  const rp = await result(pat), rs = await result(sam);
  ok(/Correct/.test(rp) && pts(rp) >= 790 && pts(rp) <= 860, `Pat's speed comes from the switch at ~4s (+${pts(rp)}, about 833)`);
  ok(/Correct/.test(rs) && pts(rs) >= 710 && pts(rs) <= 780, `Sam's single pick at ~6s (+${pts(rs)}, about 750)`);
  ok(!/Not locked in/.test(rp), 'no "not locked in" note on a picked answer');
  await next();

  // Q2: Pat picks the right answer then switches to a wrong one; Sam picks right
  await pat.waitForSelector('#pq-answers button.answer'); await sam.waitForSelector('#pq-answers button.answer');
  await tap(pat, 'Apple'); await pat.waitForTimeout(700); await tap(pat, 'Brick'); await pat.waitForTimeout(500);
  await tap(sam, 'Apple');
  const r2 = await result(pat), r2s = await result(sam);
  ok(/Not this time/.test(r2) && pts(r2) === 0, 'switching away from the right answer scores 0: ' + r2.slice(0, 40));
  ok(/Correct/.test(r2s), 'Sam correct');
  await next();

  // Q3: poll vote can be switched
  await pat.waitForSelector('#pq-answers button.answer'); await sam.waitForSelector('#pq-answers button.answer');
  await tap(pat, 'Red'); await pat.waitForTimeout(400);
  const pn = (await pat.textContent('#pq-pick-note')).trim();
  ok(pn === 'Vote in. Tap another to change it.', 'poll note: ' + pn);
  await tap(pat, 'Blue'); await pat.waitForTimeout(400);
  await tap(sam, 'Red');
  const r3 = await result(pat);
  ok(/You picked: Blue/.test(r3), 'switched vote counted: ' + r3.slice(0, 50));
  await host.waitForTimeout(800);
  const chart = await host.evaluate(() => [...document.querySelectorAll('#hq-answers .answer')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  console.log('poll tiles:', JSON.stringify(chart));
  await host.screenshot({ path: __dirname + '/out/switch-poll.png' });
  console.log('ERRORS', errs);
  await browser.close();
})();
