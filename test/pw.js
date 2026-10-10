// Mở game trong Chromium (điện thoại ngang), chụp ảnh menu / trận đấu / tua lại, bắt lỗi console.
const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  const url = 'file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/');
  await page.goto(url);
  await page.waitForTimeout(1500);
  const out = (n) => path.join(__dirname, 'shots', n);
  await page.screenshot({ path: out('1-menu.png') });
  await page.evaluate(() => { localStorage.setItem('caulong_save_v1', JSON.stringify({ tut: true })); });
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => window.__game.startMatch(2));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out('2-start.png') });
  // chơi tự động: bật tự chạy + tự đánh cho người
  await page.evaluate(() => { const m = window.__game.match; m.opts.autoMove = true; m.opts.autoHit = true; m.opts.timeScale = 1; });
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(700); await page.screenshot({ path: out(`3-rally${i}.png`) }); }
  // ép một pha cầu sát vạch để xem tua lại
  const ok = await page.evaluate(() => {
    const BL = window.BL, m = window.__game.match;
    m.startPoint();
    const p = m.players[1];
    // bot tạt cầu rơi sát biên dọc sân mình (trong 1 cm)
    const c = [0.5, 4.5, 2.6], tx = 2.59 + (window.__out ? 0.025 : -0.008), ty = -4.6;
    const dx = tx - c[0], dy = ty - c[1], d = Math.hypot(dx, dy), az = Math.atan2(dy, dx);
    const rNet = d * (c[1] / (c[1] - ty));
    const sol = BL.solveAngle(c[2], 32, d, rNet, 1.53, -0.6, 0.6);
    const th = sol.theta, sp = 32;
    const v = [sp * Math.cos(th) * Math.cos(az), sp * Math.cos(th) * Math.sin(az), sp * Math.sin(th)];
    m.players[0].x = -1.5; m.players[0].y = -2;
    m.opts.autoHit = false; m.opts.autoMove = false; m.opts.reflex = false;
    m.launch(p, c, { shot: 'drive', v, speed: sp }, false);
    return [m.shuttle.flight.land.x, m.shuttle.flight.land.y];
    return null;
  });
  console.log('forced close call', ok);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out('4-replay-a.png') });
  await page.waitForTimeout(4600);
  await page.screenshot({ path: out('4-replay-b.png') });
  // các màn hình menu
  await page.evaluate(() => { window.__game.menu(); });
  for (const [sel, name] of [['[data-go="up"]', '5-upgrade'], ['[data-go="menu"]', null], ['[data-go="rules"]', '6-rules'], ['[data-go="menu"]', null], ['[data-go="ladder"]', '7-ladder']]) {
    await page.click(sel); await page.waitForTimeout(300);
    if (name) await page.screenshot({ path: out(name + '.png') });
  }
  // dọc
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__game.startMatch(0));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out('8-portrait.png') });
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
})();
