const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  for (const [w, h, name] of [[844, 390, 'deep-land'], [390, 844, 'deep-port']]) {
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
    await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
    await page.evaluate(() => localStorage.setItem('caulong_save_v1', JSON.stringify({ tut: true })));
    await page.reload(); await page.waitForTimeout(300);
    await page.evaluate(() => {
      const BL = window.BL; window.__game.startMatch(6);
      const m = window.__game.match, me = m.players[0], b = m.players[1];
      m.phase = 'rally'; me.holding = b.holding = false;
      me.x = 0.4; me.y = -1.2; b.x = -1.2; b.y = 5.6;
      // người chơi hất cầu sâu sang góc bên kia
      const c = [0.4, -1.0, 0.5];
      m.launch(me, c, BL.planShot(me, c, 'lift', { opp: b, aimX: -0.9 }), false);
      m.opts.autoMove = false; m.opts.timeScale = 1;
    });
    await page.waitForTimeout(2100);
    await page.screenshot({ path: path.join(__dirname, 'shots', name + '.png') });
    await page.close();
  }
  await browser.close();
})();
