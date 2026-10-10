const BL = require('./load');
BL.setSeed(1);
const kmh = v => (v * 3.6).toFixed(0);
// 1) rơi tự do -> vận tốc giới hạn
let r = BL.simulateFlight([0, -3, 20], [0, 0, 0], -1);
console.log('terminal v', r.pts[(r.n - 2) * 4 + 3].toFixed(2), 'm/s, fall 20m t=', r.tFlight.toFixed(2));
// 2) đập 300 km/h từ cuối sân xuống dốc 10°
for (const v0 of [60, 83, 100]) {
  const th = -10 * Math.PI / 180;
  r = BL.simulateFlight([0, -5, 2.8], [0, v0 * Math.cos(th), v0 * Math.sin(th)], -1);
  console.log('smash', kmh(v0), 'km/h land y', r.land.y.toFixed(2), 't', r.tFlight.toFixed(3), 'vEnd', kmh(r.pts[(r.n - 1) * 4 + 3]), 'km/h net?', r.netHit);
}
// 3) phông cầu từ cuối sân: góc 45°, tốc độ cần để đến cuối sân bên kia
for (const deg of [35, 45, 55, 65]) {
  const s = BL.solveSpeed(2.5, deg * Math.PI / 180, 11.8, 6, 1.524, 5, 120);
  console.log('clear', deg, '° speed', s.speed.toFixed(1), 'm/s', kmh(s.speed), 'km/h t', s.res.t.toFixed(2), 'apex', s.res.apex.toFixed(2), 'short', s.short);
}
// tầm xa tối đa theo góc với tốc độ vô hạn
for (const deg of [30, 45, 60]) { const f = BL.fly2D(2.5, 200, deg * Math.PI / 180, 6, 1.524); console.log('max range', deg, f.range.toFixed(2)); }
