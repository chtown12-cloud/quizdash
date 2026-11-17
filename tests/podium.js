// The winners' podium: play a short game to the end and make sure all
// three columns rise into view and stay there. (Two animations once
// shared the name "rise"; the later one won, and the podium's columns
// never appeared.) Also checks no two animations in the file share a name.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const names = (src.match(/@keyframes\s+[\w-]+/g) || []).map(s => s.replace(/@keyframes\s+/, ''));
  const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
  ok(!dupes.length, `no two animations share a name${dupes.length ? ' — ' + dupes.join(', ') : ` (${names.length} checked)`}`);
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', `# Podium | 60s | read 0s\n\n## One?\n- A *\n- B\n`);
  await host.waitForTimeout(400);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  await host.click('[data-bots="10"]'); await host.waitForTimeout(800);
  await host.click('#btn-start');
  await host.waitForSelector('#hq-answers .answer'); await host.waitForTimeout(600);
  await host.click('#btn-hq-skip'); await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 20000 });
  await host.waitForTimeout(400); await host.click('#btn-hq-next');
  // on through any leaderboard to the podium
  for (let i = 0; i < 6 && !(await host.$('#s-hpodium.active')); i++){
    const b = await host.$('#s-hboard.active #btn-hb-next'); if (b) await b.click().catch(() => {});
    await host.waitForTimeout(700);
  }
  ok(!!(await host.$('#s-hpodium.active')), 'the game ends on the podium');
  for (const t of ['classic', 'deepsea', 'editorial']){
    await host.evaluate(t => applyLook(THEME_COLORS[t], t), t);
    await host.waitForFunction(() => document.querySelectorAll('#s-hpodium .pcol.shown').length >= 3, null, { timeout: 30000 });
    await host.waitForTimeout(1300);
    const cols = await host.evaluate(() => [...document.querySelectorAll('#s-hpodium .pcol')].map(el => {
      const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { op: Number(cs.opacity), in: b.top >= -2 && b.bottom <= innerHeight + 2 && b.left >= 0 && b.right <= innerWidth, h: Math.round(b.height) };
    }));
    ok(cols.length === 3 && cols.every(c => c.op > .98 && c.in && c.h > 60), `${t}: all three podium columns are in view and fully drawn (${cols.map(c => `opacity ${c.op}${c.in ? '' : ', off screen'}`).join('; ')})`);
  }
  console.log('ERRORS', errs);
  await browser.close();
})();
