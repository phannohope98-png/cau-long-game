// Phòng tạo dáng: vẽ cận cảnh từng động tác để soi tỉ lệ & khớp
const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 700 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
  await page.waitForTimeout(400);
  for (const sel of [0, 5]) {
  await page.evaluate((sel) => {
    window.__sel = sel; window.__freeze = true;
    document.getElementById('screens').innerHTML = '';
    const BL = window.BL, D = BL.Render._dbg, ctx = D.ctx;
    ctx.fillStyle = '#2a3550'; ctx.fillRect(0, 0, D.W, D.H); ctx.fillStyle='#1b7a56'; ctx.fillRect(0, D.H*0.38, D.W, D.H*0.12); ctx.fillRect(0, D.H*0.86, D.W, D.H*0.14);
    const look = { color: '#e5392f', hair: '#1a120c', skin: '#e0aa82', shorts: '#1b1d28' };
    const mk = (o) => Object.assign({ x: 0, y: -3, face: Math.PI / 2, vx: 0, vy: 0, gait: 0, jumpZ: 0, lunge: 0, holding: false, side: -1, look, sw: null }, o);
    const sw = (kind, shot, t, tc, c, fh) => ({ kind, shot, t, tc, dur: tc + 0.32, c, fh, hit: t >= tc });
    const poses = [
      ['Chờ', mk({})],
      ['Chạy', mk({ vy: 4, gait: 1.2 })],
      ['Đập: kéo vợt', mk({ sw: sw('smash', 'jsmash', 0.2, 0.3, [0.25, -2.7, 2.75], true) })],
      ['Đập: chạm', mk({ jumpZ: 0.3, sw: sw('smash', 'jsmash', 0.3, 0.3, [0.25, -2.7, 3.0], true) })],
      ['Đập: theo đà', mk({ sw: sw('smash', 'jsmash', 0.45, 0.3, [0.25, -2.7, 2.75], true) })],
      ['Lao bỏ nhỏ', mk({ lunge: 1, sw: sw('net', 'net', 0.2, 0.2, [0.7, -1.9, 0.45], true) })],
      ['Tạt thuận', mk({ sw: sw('drive', 'drive', 0.17, 0.17, [0.75, -2.8, 1.3], true) })],
      ['Trái tay thấp', mk({ lunge: 0.6, sw: sw('lift', 'lift', 0.22, 0.22, [-0.9, -2.6, 0.6], false) })],
      ['Giao cao', mk({ sw: sw('serve', 'serve_high', 0.42, 0.42, [0.12, -2.55, 0.85], true) })],
    ];
    const ps = poses.slice(sel, sel + 5); const n = ps.length, cw = D.W / n;
    for (let row = 0; row < 2; row++) {
      ps.forEach(([name, s], i) => {
        const cx = cw * i + cw / 2, cy = D.H * (row ? 0.92 : 0.45);
        const tgt = [0, -3, 1.0];
        const pos = row ? [3.2, 0.2, 1.6] : [1.2, -8, 2.2];
        D.setCam(pos, tgt);
        D.cam.focal = row ? 520 : 470; D.cam.cx = 0; D.cam.cy = 0; const q0 = BL.Render.proj([0, -3, 1.0]); D.cam.cx = cx - q0.x; D.cam.cy = (row ? D.H * 0.75 : D.H * 0.25) - q0.y;
        ctx.save(); ctx.beginPath(); ctx.rect(cw * i, row ? D.H / 2 : 0, cw, D.H / 2); ctx.clip();
        D.drawPlayer(s, null);
        if (s.sw) { const q = BL.Render.proj(s.sw.c); ctx.strokeStyle = '#ff0'; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 7); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        if (!row) ctx.fillText(name, cx, 18);
      });
    }
  }, sel);
  await page.screenshot({ path: path.join(__dirname, 'shots', 'poses' + sel + '.png') });
  }
  console.log('errors', errs);
  await browser.close();
})();
