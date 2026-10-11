// Phòng tạo dáng 3D: chụp cận cảnh người 3D ở từng động tác, 2 góc nhìn
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle'] });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 520 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
  await page.waitForFunction(() => window.BL.HumanRig && (window.BL.HumanRig.ready || window.BL.HumanRig.failed), null, { timeout: 60000 });
  console.log('rig', await page.evaluate(() => window.BL.HumanRig.ready), JSON.stringify(await page.evaluate(() => window.BL.Anim.body)));
  await page.evaluate(() => { window.__freeze = true; document.getElementById('screens').innerHTML = ''; });
  const poses = ['Chờ', 'Chạy', 'Lùi nghiêng', 'Đập: kéo vợt', 'Đập: chạm', 'Đập: theo đà', 'Vồ lưới', 'Lao bỏ nhỏ', 'Tạt thuận', 'Tạt trái tay', 'Hất thấp trái', 'Giao ngắn', 'Giao cao'];
  const dir = path.join(__dirname, 'shots', 'p3d'); fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < poses.length; i++) {
    for (const view of [0, 1]) {
      await page.evaluate(({ i, view }) => {
        const BL = window.BL, D = BL.Render3D._dbg;
        const kit = { color: '#e5392f', hair: '#1a120c', skin: '#e0aa82', shorts: '#1b1d28' };
        const mk = (o) => Object.assign({ x: 0, y: -3, face: Math.PI / 2, vx: 0, vy: 0, gait: 0, jumpZ: 0, lunge: 0, holding: false, side: -1, kit, sw: null, split: 1 }, o);
        const sw = (kind, shot, t, tc, c, fh) => ({ kind, shot, t, tc, dur: tc + 0.34, c, fh, hit: t >= tc });
        const P = [
          mk({}), mk({ vy: 4, gait: 1.3 }), mk({ vy: -3.5, gait: 0.6 }),
          mk({ sw: sw('smash', 'jsmash', 0.2, 0.3, [0.25, -2.75, 2.85], true) }),
          mk({ jumpZ: 0.3, sw: sw('smash', 'jsmash', 0.3, 0.3, [0.25, -2.7, 3.05], true) }),
          mk({ sw: sw('smash', 'jsmash', 0.46, 0.3, [0.25, -2.7, 2.85], true) }),
          mk({ y: -1.2, sw: sw('smash', 'kill', 0.18, 0.18, [0.3, -0.75, 1.85], true) }),
          mk({ lunge: 1, y: -2.4, sw: sw('net', 'net', 0.2, 0.2, [0.55, -1.15, 0.5], true) }),
          mk({ sw: sw('drive', 'drive', 0.17, 0.17, [0.8, -2.75, 1.3], true) }),
          mk({ sw: sw('drive', 'drive', 0.17, 0.17, [-0.75, -2.7, 1.3], false) }),
          mk({ lunge: 0.7, sw: sw('lift', 'lift', 0.22, 0.22, [-0.85, -2.45, 0.6], false) }),
          mk({ holding: true, serveKind: 'serve_short', heldPos: [-0.03, -2.55, 0.98] }),
          mk({ sw: sw('serve', 'serve_high', 0.42, 0.42, [0.14, -2.55, 0.85], true) }),
        ];
        const s = P[i];
        const far = mk({ x: 0, y: 4, face: -Math.PI / 2, kit: { color: '#2e7bd6', hair: '#222', skin: '#d9a07a', shorts: '#eee' } });
        const tgt = [s.x, s.y + 0.2, 1.0];
        D.updateHumans([s, far], s.sw ? s.sw.c : [0, 3, 2], false);
        D.placeShuttle(s.sw ? s.sw.c : (s.heldPos || [0, 5, -1]), [0, 0, -1], 1, 0);
        const pos = view ? [s.x + 3.0, s.y + 1.4, 1.5] : [s.x + 0.9, s.y - 4.2, 2.2];
        D.applyCam(pos, tgt, 560, 210, 270);
        D.renderer.render(D.scene, D.camera);
        const o = document.getElementById('ov'); o.getContext('2d').clearRect(0, 0, o.width, o.height);
      }, { i, view });
      await page.screenshot({ path: path.join(dir, `${String(i).padStart(2, '0')}-${view}.png`) });
    }
  }
  // ghép
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const imgs = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
  const p2 = await browser.newPage({ viewport: { width: 1680, height: 1400 } });
  for (let part = 0; part < 2; part++) {
    const sl = imgs.slice(part * 14, part * 14 + 14);
    const names = poses.slice(part * 7, part * 7 + 7);
    await p2.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(7,240px);font:14px sans-serif;color:#fff">${names.map((n, j) => `<div><div style="text-align:center">${n}</div><img src="${sl[j * 2]}" style="width:240px;height:297px"><img src="${sl[j * 2 + 1]}" style="width:240px;height:297px"></div>`).join('')}</body>`);
    await p2.waitForTimeout(300);
    await p2.screenshot({ path: path.join(__dirname, 'shots', `poses3d-${part}.png`), clip: { x: 0, y: 0, width: 1680, height: 640 } });
  }
  console.log('errors', errs);
  await browser.close();
})();
