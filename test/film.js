// Dải phim: chụp liên tiếp nhiều khung trong pha cầu để soi độ mượt động tác
const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
  await page.evaluate(() => localStorage.setItem('caulong_save_v1', JSON.stringify({ tut: true })));
  await page.reload(); await page.waitForTimeout(300);
  await page.evaluate(() => { window.BL.setSeed(12); window.__game.startMatch(5); const m = window.__game.match; m.opts.autoMove = true; m.opts.autoHit = true; m.opts.timeScale = 1; });
  // chờ tới khi người chơi chuẩn bị vung cú cao (đập/phông)
  let found = false;
  for (let i = 0; i < 2000 && !found; i++) {
    await page.waitForTimeout(25);
    found = await page.evaluate(() => { const p = window.__game.match.players[0]; return !!(p.swing && p.swing.t < 0.12 && p.swing.c && p.swing.c[2] > 1.9); });
  }
  await page.evaluate(() => { window.__game.match.opts.timeScale = 0.15; });
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(180); await page.screenshot({ path: path.join(__dirname, 'shots', `film${i}.png`), clip: { x: 250, y: 30, width: 350, height: 330 } }); }
  console.log('found', found);
  await browser.close();
})();
