const path = require('path');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 300, height: 300 } })).newPage();
  await page.goto('file:///' + path.resolve(__dirname, '..', 'index.html').split(path.sep).join('/'));
  await page.waitForFunction(() => window.BL.HumanRig && window.BL.HumanRig.ready, null, { timeout: 60000 });
  await page.evaluate(() => { window.__freeze = true; document.getElementById('screens').innerHTML = ''; });
  const vars = JSON.parse(process.argv[2]);
  const views = [[1.2, -2.3, 1.5], [-0.6, -2.0, 1.4], [0.5, -4.0, 1.6]];
  for (let i = 0; i < vars.length; i++) for (let j = 0; j < views.length; j++) {
    await page.evaluate(({ g, pos }) => {
      window.__grip = g;
      const BL = window.BL, D = BL.Render3D._dbg;
      const kit = { color: '#e5392f', hair: '#1a120c', skin: '#e0aa82', shorts: '#1b1d28' };
      const s = { x: 0, y: -3, face: Math.PI / 2, vx: 0, vy: 0, gait: 0, jumpZ: 0, lunge: 0, holding: false, side: -1, kit, sw: null, split: 1 };
      D.updateHumans([s, Object.assign({}, s, { y: 4, face: -Math.PI / 2 })], [0, 3, 2], false);
      const P = BL.Anim.pose(Object.assign({}, s, { lookAt: [0, 3, 2] }));
      D.applyCam(pos, P.rHand, 700, 150, 150);
      D.renderer.render(D.scene, D.camera);
    }, { g: vars[i], pos: views[j] });
    await page.screenshot({ path: path.join(__dirname, 'shots', `grip-${i}-${j}.png`) });
  }
  await browser.close();
})();
