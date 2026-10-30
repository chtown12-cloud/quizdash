// Big screen, picture questions: centred and big while players read (and for
// hint-only questions while answering); side by side only with tiles or a reveal
const { chromium } = require('playwright');
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const OUT = __dirname + '/out';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.QD_CHROMIUM || undefined, args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('**/gstatic.com/firebasejs/**', r => r.abort());
  const host = await ctx.newPage();
  const errs = []; host.on('pageerror', e => errs.push(e.message));
  await host.goto('http://localhost:8123/index.html');
  const THEMES = await host.evaluate(() => THEMES);
  const pic = (w, h, c) => host.evaluate(([w, h, c]) => { const k = document.createElement('canvas'); k.width = w; k.height = h; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(w * .1, h * .1, w * .3, h * .2); return k.toDataURL('image/jpeg', .8); }, [w, h, c]);
  const map = await pic(900, 1100, '#cfe6f5'), wide = await pic(1200, 675, '#f08a5d');
  const MD = `# Read pics | 30s | read 30s\n\n## Here's a picture of New England in the USA. Where is Salem, Massachusetts?\n![](${map})\n= 72%, 66% ± 6%\n\n## Which lake is this?\n![](${wide})\n- Como *\n- Garda\n- Geneva\n- Lugano\n`;
  await host.click('#btn-go-host'); await host.click('#tab-write');
  await host.fill('#quiz-input', MD); await host.waitForTimeout(500);
  await host.click('#btn-create'); const sb = await host.$('.savebox'); if (sb) await host.click('.savebox [data-k="skip"]');
  await host.waitForSelector('#s-hlobby.active');
  const phone = await ctx.newPage(); await phone.setViewportSize({ width: 390, height: 844 });
  await phone.goto('http://localhost:8123/index.html?room=' + await host.textContent('#hlobby-code'));
  await phone.fill('#join-name', 'Pat'); await phone.click('#btn-join'); await phone.waitForSelector('#s-plobby.active');
  await host.bringToFront();
  const m = () => host.evaluate(() => {
    if (typeof fitHost === 'function') fitHost();
    const s = document.getElementById('s-hquestion'), st = s.querySelector(':scope > .center.stack'), im = document.getElementById('hq-img');
    const r = im.getBoundingClientRect();
    // "uses the room": either at its size cap, or the screen is full (nothing left to grow into)
    const cap = parseFloat(getComputedStyle(im).maxHeight) * (parseFloat(st.style.zoom) || 1);
    const room = r.height >= Math.min(cap, im.naturalHeight) - 2 || s.offsetHeight >= innerHeight - 24;
    return { grid: getComputedStyle(st).display === 'grid', h: Math.round(r.height), w: Math.round(r.width), off: Math.round(Math.abs((r.left + r.right) / 2 - innerWidth / 2)),
      over: s.offsetHeight - innerHeight, shown: !im.hidden && r.height > 0, room, fs: Math.round(parseFloat(getComputedStyle(document.getElementById('hq-text')).fontSize)) };
  });
  const look = async t => { await host.evaluate(t => applyLook(THEME_COLORS[t], t), t); await host.waitForTimeout(450); };
  const centred = async (label, sizes) => {
    for (const [w, h, themes] of sizes){
      await host.setViewportSize({ width: w, height: h });
      for (const t of themes){
        await look(t); const x = await m();
        const min = Math.round(h * .33);
        ok(x.shown && !x.grid && x.off <= 4 && x.h >= min && x.room && x.over <= 1, `${label} ${w}x${h} ${t}: centred (${x.off}px off), ${x.h}px tall (≥${min}${x.room ? ', uses all the room' : ', ROOM LEFT OVER'}), question ${x.fs}px, ${x.over <= 1 ? 'fits' : 'SCROLLS ' + x.over}`);
        if (t === 'spooky' && w === 1000) await host.screenshot({ path: `${OUT}/${label.replace(/\W+/g, '-')}-${w}.png` });
      }
    }
  };
  const ALL = [[1000, 655, ['spooky', 'classic', 'brutalist', 'doodle']], [1280, 720, THEMES], [1920, 1080, ['spooky', 'editorial', 'arcade', 'candy']]];
  await host.click('#btn-start');

  // Q1 tap-the-spot: reading, then answering (hint only)
  await host.waitForSelector('#btn-hq-skip', { state: 'visible' });
  await host.waitForFunction(() => !document.getElementById('hq-img').hidden);
  await centred('tap, while reading', ALL);
  await host.setViewportSize({ width: 1280, height: 720 });
  await host.click('#btn-hq-skip');
  await host.waitForSelector('#hq-answers .bighint');
  await centred('tap, while answering', [[1000, 655, ['spooky', 'classic']], [1280, 720, ['spooky', 'candy']], [1920, 1080, ['spooky']]]);
  await host.setViewportSize({ width: 1280, height: 720 });
  await host.click('#btn-hq-skip');
  await host.waitForSelector('#btn-hq-next', { state: 'visible', timeout: 20000 });
  await host.waitForTimeout(500); await host.click('#btn-hq-next'); await host.waitForTimeout(600);
  if (await host.$('#s-hboard.active')){ await host.waitForTimeout(700); await host.click('#btn-hb-next'); }

  // Q2 multiple choice: centred while reading, beside the tiles once they're up
  await host.waitForSelector('#btn-hq-skip', { state: 'visible' });
  await host.waitForFunction(() => !document.getElementById('hq-img').hidden);
  await centred('multiple choice, while reading', [[1000, 655, ['spooky', 'terminal']], [1280, 720, ['spooky', 'noir']], [1920, 1080, ['spooky']]]);
  await host.setViewportSize({ width: 1280, height: 720 });
  await host.click('#btn-hq-skip');
  await host.waitForSelector('#hq-answers .answer');
  for (const t of ['spooky', 'classic']){
    await look(t); const x = await m();
    const side = await host.evaluate(() => document.getElementById('hq-img').getBoundingClientRect().right <= document.getElementById('hq-answers').getBoundingClientRect().left + 1);
    ok(x.grid && side && x.over <= 1, `multiple choice, while answering ${t}: picture beside the tiles, ${x.h}px`);
  }
  await host.setViewportSize({ width: 1000, height: 655 }); await look('spooky');
  await host.screenshot({ path: `${OUT}/mc-answering-1000.png` });
  console.log('ERRORS', errs);
  await browser.close();
})();
