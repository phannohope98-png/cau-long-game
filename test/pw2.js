// Chơi thật bằng chuột như ngón tay: giữ & kéo cần điều khiển, bấm nút theo vùng.
const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
  await page.evaluate(() => localStorage.setItem('caulong_save_v1', JSON.stringify({ tut: false })));
  await page.reload(); await page.waitForTimeout(400);
  await page.click('[data-go="ladder"]'); await page.waitForTimeout(200);
  await page.click('[data-go="play"][data-i="0"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'shots', '9-tutorial.png') });
  await page.click('#tutOk');
  const jb = await page.locator('#joyBase').boundingBox();
  const jc = { x: jb.x + jb.width / 2, y: jb.y + jb.height / 2 };
  const btn = async (i) => { const b = await page.locator(`.shot[data-i="${i}"]`).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
  // dùng touch cho nút để không nhả cần (chuột chỉ có 1 con trỏ): gọi pointer event qua dispatch
  const tap = async (i) => page.evaluate((i) => { const el = document.querySelector(`.shot[data-i="${i}"]`); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 })); }, i);
  await page.mouse.move(jc.x, jc.y); await page.mouse.down();
  let shots = 0, pressedFor = -1, moved = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    const st = await page.evaluate(() => {
      const m = window.__game.match; if (!m) return null;
      const me = m.players[0], sh = m.shuttle;
      let tgt = null;
      if (m.phase === 'rally' && sh.hitter === 1) tgt = window.BL.AI.intercept(me, m, 0);
      return { phase: m.phase, srv: m.score.server, hitter: sh.hitter, tHit: sh.tHit, t: m.t, me: [me.x, me.y], tgt: tgt && [tgt.x, tgt.y], pts: m.score.pts, swing: !!me.swing };
    });
    if (!st) break;
    if (st.phase === 'over') break;
    let dx = 0, dy = 0;
    if (st.tgt) { dx = st.tgt[0] - st.me[0]; dy = st.tgt[1] - st.me[1]; }
    else if (st.phase === 'rally') { dx = 0 - st.me[0]; dy = -3.4 - st.me[1]; }
    const d = Math.hypot(dx, dy);
    // màn hình: phải = +x, lên = +y (về lưới)
    const k = d > 0.15 ? 55 : 0;
    await page.mouse.move(jc.x + (d ? dx / d : 0) * k, jc.y - (d ? dy / d : 0) * k);
    if (k) moved++;
    if (st.phase === 'serve' && st.srv === 0) { await tap(1); shots++; }
    if (st.phase === 'rally' && st.hitter === 1 && pressedFor !== st.tHit && st.t - st.tHit > 0.3) { pressedFor = st.tHit; await tap(Math.floor(Math.random() * 3)); shots++; }
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await page.screenshot({ path: path.join(__dirname, 'shots', '10-play.png') });
  const fin = await page.evaluate(() => { const m = window.__game.match; return { pts: m.score.pts, hist: m.score.history, me: m.players[0].st, op: m.players[1].st }; });
  console.log('presses', shots, 'moved frames', moved, JSON.stringify(fin));
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
})();
