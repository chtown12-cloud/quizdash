// Phones get a lighter copy of pasted pictures; links pass through; tap-the-spot still scores right
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  // a big noisy photo, the kind that sits near the 120 KB budget after pasting
  const shoot = await host.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1600; c.height = 1000; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 1000); sky.addColorStop(0, '#2b4a8b'); sky.addColorStop(.6, '#f08a5d'); sky.addColorStop(1, '#3a2c3f');
    g.fillStyle = sky; g.fillRect(0, 0, 1600, 1000);
    for (let i = 0; i < 60000; i++){ g.fillStyle = `hsla(${Math.random() * 360},60%,50%,.25)`; g.fillRect(Math.random() * 1600, Math.random() * 1000, 3, 3); }
    g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(1200, 300, 90, 0, 7); g.fill();   // the spot to tap: right half, upper part
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const shot = await Shots.shrink(blob);   // exactly what pasting does
    return shot.url;
  });
  const LINK = 'https://example.com/pic.jpg';
  const MD = `# Pics | 30s | read 0s\n\n## What is this?\n![](${shoot})\n- A sunset *\n- A cat\n![answer](${shoot})\n\n## Tap the sun\n![](${shoot})\n= 75%, 30% ± 10%\n\n## A linked picture\n![](${LINK})\n- Yes *\n- No\n`;
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', MD); await host.waitForTimeout(500);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  const code = await host.textContent('#hlobby-code');
  const pat = await ctx.newPage(); pat.on('pageerror', e => errs.push('pat: ' + e.message));
  await pat.setViewportSize({ width: 390, height: 844 });
  await pat.goto('http://localhost:8123/index.html?room=' + code);
  await pat.fill('#join-name', 'Pat'); await pat.click('#btn-join'); await pat.waitForSelector('#s-plobby.active');
  const full = await host.evaluate(() => Shots.bytes(Shots.resolve(Host.quiz.questions[0].image)));
  console.log('pasted picture on the big screen:', Math.round(full / 1024), 'KB');
  const state = () => host.evaluate(c => Sync.get(`rooms/${c}/state`), code);
  const kb = u => Math.round((u.length - u.indexOf(',') - 1) * .75 / 1024);
  const next = async () => { await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 25000 }); await host.waitForTimeout(500); await host.click('#btn-hq-next'); await host.waitForTimeout(500); if (await host.$('#s-hboard.active')){ await host.waitForTimeout(600); await host.click('#btn-hb-next'); } };
  await host.click('#btn-start');

  // Q1: question picture and answer picture
  await pat.waitForSelector('#pq-answers .answer');
  let st = await state();
  ok(/^data:image\//.test(st.q.img) && kb(st.q.img) <= 41 && kb(st.q.img) * 2.5 < full / 1024, `phones get a lighter question picture: ${kb(st.q.img)} KB (big screen ${Math.round(full / 1024)} KB)`);
  await pat.waitForFunction(() => { const i = document.getElementById('pq-img'); return !i.hidden && i.naturalWidth; });
  const nat = await pat.$eval('#pq-img', i => [i.naturalWidth, i.naturalHeight]);
  ok(nat[0] <= 800 && Math.abs(nat[0] / nat[1] - 1.6) < .01, `it shows on the phone, ${nat[0]}×${nat[1]}, same shape`);
  ok(await host.evaluate(() => document.getElementById('hq-img').naturalWidth) > 1000, 'the big screen keeps its full picture');
  await pat.click('#pq-answers .answer >> text=A sunset');
  await pat.waitForSelector('#s-presult.active', { timeout: 20000 }); await pat.waitForTimeout(800);
  st = await state();
  ok(/^data:image\//.test(st.ansImg) && kb(st.ansImg) <= 41, `phones get a lighter answer picture: ${kb(st.ansImg)} KB`);
  ok(await pat.$eval('.pr-ansimg', i => !i.hidden && i.naturalWidth > 0), 'the answer picture shows on the phone');
  await next();

  // Q2: tap-the-spot on the lighter copy still lands where it should
  await pat.waitForSelector('#pq-answers .tapwrap img');
  await pat.waitForFunction(() => document.querySelector('#pq-answers .tapwrap img').naturalWidth);
  const b = await (await pat.$('#pq-answers .tapwrap img')).boundingBox();
  await pat.touchscreen.tap(b.x + b.width * .75, b.y + b.height * .3);
  await host.waitForTimeout(400); await host.click('#btn-hq-skip');
  await pat.waitForSelector('#s-presult.active', { timeout: 20000 }); await pat.waitForTimeout(600);
  const r2 = (await pat.textContent('#pr-body')).replace(/\s+/g, ' ');
  ok(/You found it/.test(r2), 'tap-the-spot on the lighter copy scores: ' + r2.slice(0, 30));
  await next();

  // Q3: a link travels untouched
  await pat.waitForSelector('#pq-answers .answer');
  st = await state();
  ok(st.q.img === LINK, 'a linked picture travels as its link: ' + st.q.img);
  console.log('ERRORS', errs);
  await browser.close();
})();
