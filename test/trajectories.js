// Vẽ quỹ đạo từng cú (nhìn ngang) + phân bố điểm rơi (nhìn từ trên) ra ảnh PNG
const path = require('path');
const BL = require('./load');
const { chromium } = require(path.join('C:/Users/KHAIMINHSOLAR/Desktop/game/node_modules/playwright'));
BL.setSeed(21);
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
const p = { side: -1, d: BL.derive(lv(60)), energy: 100 };
const opp = { x: 0, y: 3.5 };
const shots = [
  ['clear', [0.3, -6.0, 2.6], '#4fc3f7', 'Phông cầu'],
  ['drop', [0.3, -6.0, 2.6], '#81c784', 'Ve cầu'],
  ['jsmash', [0.3, -5.5, 2.95], '#ff5252', 'Nhảy đập'],
  ['lift', [0.3, -0.9, 0.45], '#ffd54f', 'Hất cầu'],
  ['net', [0.3, -0.9, 0.7], '#ce93d8', 'Bỏ nhỏ'],
  ['drive', [0.3, -3.5, 1.3], '#ff9800', 'Tạt ngang'],
  ['serve_high', [-0.4, -2.9, 0.85], '#90a4ae', 'Giao cao sâu'],
  ['serve_short', [-0.4, -2.9, 0.98], '#f48fb1', 'Giao ngắn'],
];
const side = [], top = [];
for (const [s, c, col, name] of shots) {
  const pl = BL.planShot(p, c, s, { opp, aimX: 0.3, rl: 'R', pressure: 0, stretch: 0 });
  const f = BL.simulateFlight(c, pl.v, -1);
  const pts = [];
  for (let i = 0; i < f.n; i += 4) pts.push([f.pts[i * 4 + 1], f.pts[i * 4 + 2]]);
  pts.push([f.land.y, 0]);
  side.push({ col, name: `${name}: ${Math.round(pl.speed * 3.6)} km/h, bay ${f.tFlight.toFixed(2)} s, đỉnh ${f.apex.toFixed(1)} m`, pts });
  const lands = [];
  for (let i = 0; i < 150; i++) {
    const q = BL.planShot(p, c, s, { opp, aimX: null, rl: 'R', pressure: 0, stretch: 0.2 });
    const g = BL.simulateFlight(c, q.v, -1);
    lands.push([g.land.x, g.land.y, g.netHit ? 1 : 0]);
  }
  top.push({ col, name, lands });
}
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await pg.setContent('<canvas id=c width=1400 height=900></canvas>');
  await pg.evaluate(({ side, top }) => {
    const cv = document.getElementById('c'), x = cv.getContext('2d');
    x.fillStyle = '#0f1424'; x.fillRect(0, 0, 1400, 900);
    // --- nhìn ngang ---
    const SX = (y) => 60 + (y + 7) * 62, SZ = (z) => 470 - z * 48;
    x.fillStyle = '#1b7a56'; x.fillRect(SX(-6.7), SZ(0), SX(6.7) - SX(-6.7), 6);
    x.strokeStyle = '#ddd'; x.lineWidth = 3; x.beginPath(); x.moveTo(SX(0), SZ(0)); x.lineTo(SX(0), SZ(1.524)); x.stroke();
    x.fillStyle = '#9aa6c3'; x.font = '13px sans-serif';
    for (let z = 0; z <= 9; z++) { x.fillText(z + ' m', 10, SZ(z) + 4); x.strokeStyle = 'rgba(255,255,255,0.06)'; x.lineWidth = 1; x.beginPath(); x.moveTo(SX(-7), SZ(z)); x.lineTo(SX(7), SZ(z)); x.stroke(); }
    for (const yy of [-6.7, -1.98, 1.98, 6.7]) { x.fillStyle = '#fff'; x.fillRect(SX(yy) - 1, SZ(0), 2, 8); }
    x.fillStyle = '#fff'; x.font = 'bold 18px sans-serif';
    x.fillText('Quỹ đạo nhìn ngang (người đánh bên trái, lưới ở giữa) — lực cản bậc 2, vận tốc rơi tối đa 6.8 m/s', 60, 28);
    side.forEach((s, i) => {
      x.strokeStyle = s.col; x.lineWidth = 2.5; x.beginPath();
      s.pts.forEach((q, j) => (j ? x.lineTo(SX(q[0]), SZ(q[1])) : x.moveTo(SX(q[0]), SZ(q[1]))));
      x.stroke();
      x.fillStyle = s.col; x.font = '13px sans-serif'; x.fillText('■ ' + s.name, 900, 60 + i * 19);
    });
    // --- nhìn từ trên: điểm rơi (sân đối thủ) ---
    const TX = (xx) => 100 + (xx + 3.05) * 50, TY = (yy) => 520 + yy * 50;
    x.fillStyle = '#1b7a56'; x.fillRect(TX(-3.05), TY(0), TX(3.05) - TX(-3.05), TY(6.7) - TY(0));
    x.strokeStyle = '#fff'; x.lineWidth = 1.5;
    x.strokeRect(TX(-2.59), TY(0), TX(2.59) - TX(-2.59), TY(6.7) - TY(0));
    x.strokeRect(TX(-3.05), TY(0), TX(3.05) - TX(-3.05), TY(6.7) - TY(0));
    x.beginPath(); x.moveTo(TX(-3.05), TY(1.98)); x.lineTo(TX(3.05), TY(1.98)); x.moveTo(TX(0), TY(1.98)); x.lineTo(TX(0), TY(6.7)); x.stroke();
    x.fillStyle = '#ddd'; x.fillRect(TX(-3.05), TY(0) - 3, TX(3.05) - TX(-3.05), 3);
    x.fillStyle = '#fff'; x.font = 'bold 16px sans-serif'; x.fillText('Điểm rơi 150 cú mỗi loại (sân đối thủ, lưới ở trên)', 60, 505);
    top.forEach((t) => { for (const l of t.lands) { x.fillStyle = l[2] ? '#fff' : t.col; x.globalAlpha = 0.7; x.beginPath(); x.arc(TX(l[0]), TY(Math.max(0, l[1])), 2.5, 0, 7); x.fill(); } });
    x.globalAlpha = 1;
    top.forEach((t, i) => { x.fillStyle = t.col; x.font = '14px sans-serif'; x.fillText('● ' + t.name, 480, 560 + i * 22); });
    x.fillStyle = '#9aa6c3'; x.fillText('(chấm trắng ở mép lưới = cầu chạm lưới)', 480, 560 + top.length * 22 + 8);
  }, { side, top });
  await pg.screenshot({ path: path.join(__dirname, 'shots', 'trajectories.png') });
  await b.close();
})();
