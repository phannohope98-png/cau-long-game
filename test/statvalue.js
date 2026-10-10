// Mỗi chỉ số +30 so với bản gốc 40: tỉ lệ thắng điểm phải > 50% (chỉ số nào cũng có giá trị)
const run = require('./sim.js'); const BL = globalThis.BL;
const base = () => { const o = {}; for (const s of BL.STATS) o[s.id] = 40; return o; };
const N = +process.argv[2] || 10;
for (const s of BL.STATS) {
  let pw = 0, pl = 0, gw = 0;
  for (let i = 0; i < N; i++) {
    const a = base(); a[s.id] = 70;
    const r = run(a, base(), 3000 + i * 31, process.argv[3] || 'one');
    gw += r.winner === 0 ? 1 : 0;
    pw += r.score.history.length ? r.score.history[0][0] : r.score.pts[0];
    pl += r.score.history.length ? r.score.history[0][1] : r.score.pts[1];
  }
  console.log(s.short.padEnd(10), 'thắng trận', gw + '/' + N, ' tỉ lệ điểm', (pw / (pw + pl) * 100).toFixed(1) + '%');
}
