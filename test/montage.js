// ghép các ảnh film*.png thành 1 dải bằng Chromium
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
(async () => {
  const dir = path.join(__dirname, 'shots');
  const files = fs.readdirSync(dir).filter((f) => /^film\d+\.png$/.test(f)).sort();
  const imgs = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 700 } });
  await p.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(4,350px);gap:0">${imgs.map((s) => `<img src="${s}" style="width:350px;height:330px">`).join('')}</body>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(dir, 'filmstrip.png'), clip: { x: 0, y: 0, width: 1400, height: 660 } });
  await b.close();
})();
