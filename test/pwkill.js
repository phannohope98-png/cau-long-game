// Vồ lưới: bot trả cầu bổng sát lưới, người đứng trên lưới -> nút đổi thành "Vồ lưới", bấm -> đập cắm xuống
const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
  await page.evaluate(() => localStorage.setItem('caulong_save_v1', JSON.stringify({ tut: true })));
  await page.reload(); await page.waitForTimeout(300);
  let ok = 0, tries = 0, labels = [];
  for (let i = 0; i < 6; i++) {
    const r = await page.evaluate((i) => {
      const BL = window.BL; BL.setSeed(50 + i); window.__game.startMatch(0);
      const m = window.__game.match, me = m.players[0], b = m.players[1];
      m.opts.timeScale = 1; m.opts.reflex = false;
      m.phase = 'rally'; me.holding = b.holding = false;
      me.x = 0.2; me.y = -1.0; b.x = 0.3; b.y = 1.4;
      // bot bỏ nhỏ hỏng: cầu bay bổng qua lưới
      const c = [0.3, 1.2, 0.5];
      m.launch(b, c, { shot: 'net', v: [(i % 3 - 1) * 0.5, -3.0, 6.6], speed: 7.2 }, false);
      return true;
    }, i);
    await page.waitForFunction(() => window.__game.match.t > 0.25, null, { timeout: 30000 });
    const st = await page.evaluate(() => { const m = window.__game.match; return { btn: m.buttons(0), zone: m.zone(0), lbl: document.querySelector('.shot[data-i="0"] b').textContent }; });
    labels.push(st.lbl);
    if (st.btn[0] === 'kill') {
      tries++;
      await page.evaluate(() => { const el = document.querySelector('.shot[data-i="0"]'); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); });
      console.log('   after press', await page.evaluate(() => { const m = window.__game.match, p = m.players[0]; return JSON.stringify({ intent: p.intent, swing: p.swing && p.swing.shot, pi: m.shuttle.pi, n: m.shuttle.flight.n, phase: m.phase, t: m.t.toFixed(2) }); }));
      if (i === 0) { await page.waitForTimeout(120); await page.screenshot({ path: path.join(__dirname, 'shots', 'kill.png') }); }
      await page.waitForFunction(() => window.__game.match.t > 1.4, null, { timeout: 30000 });
      const res = await page.evaluate(() => window.__game.match.events.filter((e) => e.type === 'contact' && e.who === 0).map((e) => e.shot + ':' + (e.ok ? 'ok' : 'fail') + ':' + e.prob.toFixed(2)));
      if (res.some((x) => x.startsWith('kill:ok'))) ok++; else console.log('   ', JSON.stringify(res));
    }
  }
  console.log('kill button shown', tries, '/6, kills executed', ok, 'labels', labels.join('|'), 'errors', errs);
  await browser.close();
})();
