// Bắn từng loại cú đánh 300 lần từ vị trí thực tế, đo tỉ lệ trong/ngoài/lưới, thời gian bay, tốc độ.
const BL = require('./load');
BL.setSeed(7);
const mkP = (lv) => { const st = {}; for (const s of BL.STATS) st[s.id] = lv; return { side: -1, d: BL.derive(st), energy: 100 }; };
const cases = [
  ['clear', [0.5, -6.0, 2.5]], ['drop', [0.5, -6.0, 2.5]], ['jsmash', [0.5, -5.5, 2.9]], ['jsmash', [0.5, -3.5, 2.7]],
  ['net', [0.8, -1.0, 0.6]], ['net', [0.8, -1.2, 1.2]], ['crossnet', [1.5, -1.0, 0.7]], ['lift', [-1.2, -1.0, 0.4]],
  ['drive', [1.8, -3.5, 1.3]], ['block', [1.2, -3.5, 0.6]], ['defend', [1.2, -3.8, 0.9]], ['kill', [0.3, -1.0, 2.0]],
  ['serve_short', [-0.5, -2.3, 1.0]], ['serve_high', [-0.5, -2.6, 0.9]], ['serve_flick', [-0.5, -2.3, 1.0]],
];
for (const lv of [30, 90]) {
  const p = mkP(lv);
  console.log(`\n== chỉ số ${lv}: smash ${(p.d.smash * 3.6).toFixed(0)} km/h, clearMax ${p.d.clearMax.toFixed(1)}`);
  for (const [shot, c] of cases) {
    let inn = 0, out = 0, net = 0, t = 0, vEnd = 0, ap = 0, sp = 0, depth = 0, svcFault = 0;
    const N = 300;
    for (let i = 0; i < N; i++) {
      const pl = BL.planShot(p, c, shot, { opp: { x: 0, y: 3.5 }, aimX: null, rl: 'R', pressure: 0, stretch: 0.2 });
      const r = BL.simulateFlight(c, pl.v, -1);
      t += r.tFlight; ap += r.apex; sp += pl.speed;
      vEnd += r.pts[(r.n - 1) * 4 + 3];
      if (r.netHit) net++;
      else if (BL.inSingles(r.land.x, r.land.y, 1)) { inn++; depth += r.land.y; if (shot.startsWith('serve') && !BL.inServiceBox(r.land.x, r.land.y, 1, 'R')) svcFault++; }
      else out++;
    }
    console.log(shot.padEnd(12), `in ${(inn / N * 100).toFixed(0)}% out ${(out / N * 100).toFixed(0)}% net ${(net / N * 100).toFixed(0)}%`,
      `| v0 ${(sp / N * 3.6).toFixed(0)}km/h tới ${(vEnd / N * 3.6).toFixed(0)}km/h bay ${(t / N).toFixed(2)}s đỉnh ${(ap / N).toFixed(2)}m sâu ${(depth / Math.max(1, inn)).toFixed(2)}` + (svcFault ? ` lỗi ô ${svcFault}` : ''));
  }
}
