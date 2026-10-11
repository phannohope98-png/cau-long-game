// Cận cảnh đầu/tóc và bàn tay nắm vợt của người 3D thật
const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 600, height: 600 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
  await page.waitForFunction(() => window.BL.HumanRig && (window.BL.HumanRig.ready || window.BL.HumanRig.failed), null, { timeout: 60000 });
  await page.evaluate(() => { window.__freeze = true; document.getElementById('screens').innerHTML = ''; });
  const shots = [['head-back', 'head', [0.3, -3.9, 1.9]], ['head-front', 'head', [0.35, -1.9, 1.75]], ['head-side', 'head', [1.0, -3.0, 1.75]], ['hand', 'hand', [1.1, -2.5, 1.5]], ['hand2', 'hand', [0.2, -2.0, 1.6]], ['body-front', 'body', [0.6, -0.6, 1.3]]];
  for (const [name, what, pos] of shots) {
    await page.evaluate(({ what, pos }) => {
      const BL = window.BL, D = BL.Render3D._dbg;
      const kit = { color: '#e5392f', hair: '#1a120c', skin: '#e0aa82', shorts: '#1b1d28' };
      const s = { x: 0, y: -3, face: Math.PI / 2, vx: 0, vy: 0, gait: 0, jumpZ: 0, lunge: 0, holding: false, side: -1, kit, sw: null, split: 1 };
      const far = Object.assign({}, s, { y: 4, face: -Math.PI / 2 });
      D.updateHumans([s, far], [0, 3, 2], false);
      const P = BL.Anim.pose(Object.assign({}, s, { lookAt: [0, 3, 2] }));
      const tgt = what === 'head' ? P.head : what === 'hand' ? P.rHand : [0, -3, 1.0];
      const f = what === 'body' ? 700 : 1900;
      D.applyCam(pos, tgt, f, 300, 300);
      D.renderer.render(D.scene, D.camera);
      const o = document.getElementById('ov'); o.getContext('2d').clearRect(0, 0, o.width, o.height);
    }, { what, pos });
    await page.screenshot({ path: path.join(__dirname, 'shots', 'cu-' + name + '.png') });
  }
  console.log('errors', errs);
  await browser.close();
})();
