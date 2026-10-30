// Build page: Look & feel on top; add/duplicate under each card; a test run ends back at the questions
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  await host.click('#btn-go-host');
  await host.click('#tab-write');
  await host.fill('#quiz-input', `# Build | 20s | read 0s\n\n## First?\n- A *\n- B\n\n## Second?\n- C *\n- D\n\n## Third?\n- E *\n- F\n`);
  await host.waitForTimeout(400);
  await host.click('#tab-build'); await host.waitForTimeout(300);

  // 3. Look & feel first
  const order = await host.evaluate(() => {
    const look = document.querySelector('details.lookbox'), qs = document.getElementById('qlist');
    return { lookFirst: !!(look.compareDocumentPosition(qs) & Node.DOCUMENT_POSITION_FOLLOWING), above: look.getBoundingClientRect().top < qs.getBoundingClientRect().top,
      look: look.querySelector('summary').textContent.replace(/\s+/g, ' ').trim(), qh: [...document.querySelectorAll('#s-setup h2')].map(h => h.textContent.trim()) };
  });
  ok(order.lookFirst && order.above && /^1 · Look & feel/.test(order.look) && order.qh.includes('2 · Your questions'), `Look & feel on top: "${order.look}", then ${JSON.stringify(order.qh)}`);
  await host.screenshot({ path: __dirname + '/out/setup-top.png' });
  // …and it wears a turning rainbow edge in every theme, so it can't be missed
  const rainbow = await host.evaluate(async () => {
    const card = document.querySelector('.card.lookcard'), out = [];
    for (const t of THEMES){
      applyLook(THEME_COLORS[t], t);
      const cs = getComputedStyle(card), a = cs.getPropertyValue('--spin');
      await new Promise(r => setTimeout(r, 250));
      const b = getComputedStyle(card).getPropertyValue('--spin');
      if (!(cs.borderTopWidth === '4px' && /conic-gradient/.test(cs.backgroundImage) && a !== b)) out.push(`${t}: ${cs.borderTopWidth} ${cs.backgroundImage.slice(0, 30)} ${a}→${b}`);
    }
    applyLook(THEME_COLORS.classic, 'classic');
    return out;
  });
  ok(!rainbow.length, 'Look & feel wears a turning rainbow edge in every theme' + (rainbow.length ? ': ' + rainbow.join('; ') : ''));

  // 1. add below / duplicate from the card itself
  const texts = () => host.$$eval('#qlist .qcard [data-text]', ins => ins.map(i => i.value));
  ok(await host.$$eval('#qlist .qcard .qcard-foot', f => f.length) === 3, 'every card has its own footer');
  await host.click('#qlist .qcard[data-q="0"] [data-addbelow]');
  await host.waitForTimeout(500);
  let t = await texts();
  const focused = await host.evaluate(() => document.activeElement && document.activeElement.closest('.qcard') && document.activeElement.closest('.qcard').dataset.q);
  ok(t.join('|') === 'First?||Second?|Third?' && focused === '1', `"+ Add question below" puts a blank card right under Q1 and you can type straight in (${JSON.stringify(t)}, focus on card ${focused})`);
  await host.keyboard.type('Inserted?');
  await host.fill('#qlist .qcard[data-q="1"] [data-opt="0"]', 'X');
  await host.fill('#qlist .qcard[data-q="1"] [data-opt="1"]', 'Y');
  await host.waitForTimeout(300);
  ok(/## First\?[\s\S]*## Inserted\?[\s\S]*## Second\?/.test(await host.inputValue('#quiz-input')), 'it lands between Q1 and Q2 in the quiz');
  await host.click('#qlist .qcard[data-q="2"] .qcard-foot [data-dup]');
  await host.waitForTimeout(500);
  t = await texts();
  ok(t.join('|') === 'First?|Inserted?|Second?|Second?|Third?', 'Duplicate under a card copies it right below: ' + JSON.stringify(t));
  const inView = await host.evaluate(() => { const c = document.querySelector('#qlist .qcard[data-q="3"]').getBoundingClientRect(); return c.top >= 0 && c.bottom <= innerHeight + 200 && document.querySelector('#qlist .qcard[data-q="3"]').classList.contains('fresh'); });
  ok(inView, 'the copy scrolls into view and glows');
  await host.screenshot({ path: __dirname + '/out/card-foot.png' });

  // 2. a test run ends back at the questions, on the one it reached
  await host.click('#btn-test');
  const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  ok((await host.textContent('#s-hlobby .topbar .homebtn')).trim() === 'Back to editing', 'test run lobby: the Home button reads "Back to editing"');
  await host.click('#btn-start');
  await host.waitForSelector('#hq-answers .answer');
  await host.click('#btn-hq-skip'); await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 20000 });
  await host.waitForTimeout(400); await host.click('#btn-hq-next'); await host.waitForTimeout(500);
  if (await host.$('#s-hboard.active')){ await host.waitForTimeout(600); await host.click('#btn-hb-next'); }
  await host.waitForSelector('#hq-answers .answer');
  await host.waitForFunction(() => document.getElementById('hq-progress').textContent.startsWith('Q2'));
  const iconTitle = await host.getAttribute('#s-hquestion button.iconly[onclick="goHome()"]', 'title');
  ok(iconTitle === 'Back to editing', 'on a question, the home icon says "Back to editing"');
  await host.click('#s-hquestion button.iconly[onclick="goHome()"]');
  await host.waitForSelector('#s-setup.active', { timeout: 5000 }).catch(() => {});
  await host.waitForTimeout(900);
  const back = await host.evaluate(() => ({ setup: document.getElementById('s-setup').classList.contains('active'), landing: document.getElementById('s-landing').classList.contains('active'),
    test: Host.testRun, glow: [...document.querySelectorAll('#qlist .qcard.fresh')].map(c => c.querySelector('[data-text]').value),
    seen: (() => { const c = document.querySelector('#qlist .qcard.fresh'); if (!c) return false; const r = c.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; })() }));
  ok(back.setup && !back.landing && !back.test, 'ending the test run goes back to the questions, not the home page');
  ok(back.glow.join() === 'Inserted?' && back.seen, `…scrolled to the question it reached (Q2: ${JSON.stringify(back.glow)})`);
  await host.screenshot({ path: __dirname + '/out/back-to-edit.png' });

  // a test run that reaches the podium
  await host.click('#tab-write'); await host.fill('#quiz-input', `# Short | 20s | read 0s\n\n## Only?\n- A *\n- B\n`); await host.waitForTimeout(300); await host.click('#tab-build');
  await host.click('#btn-test');
  const sb2 = await host.$('.savebox'); if (sb2) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active'); await host.click('#btn-start');
  await host.waitForSelector('#hq-answers .answer'); await host.click('#btn-hq-skip');
  await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 20000 }); await host.waitForTimeout(400); await host.click('#btn-hq-next');
  await host.waitForSelector('#btn-hp-home', { state: 'visible', timeout: 40000 });
  ok((await host.textContent('#btn-hp-home')).trim() === 'Back to editing', 'podium after a test run: "Back to editing"');
  await host.click('#btn-hp-home'); await host.waitForTimeout(600);
  ok(await host.evaluate(() => document.getElementById('s-setup').classList.contains('active')), '…and it goes back to the questions');

  // a real game still goes home
  await host.click('#btn-create');
  const sb3 = await host.$('.savebox'); if (sb3) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  ok((await host.textContent('#s-hlobby .topbar .homebtn')).trim() === 'Home', 'a real room: the button reads "Home" again');
  await host.click('#s-hlobby .topbar .homebtn'); await host.waitForTimeout(500);
  ok(await host.evaluate(() => document.getElementById('s-landing').classList.contains('active')), '…and goes to the home page');
  console.log('ERRORS', errs);
  await browser.close();
})();
