// Bot đấu bot: chạy nhiều trận, kiểm tra bất biến (không treo, không NaN, không qua lưới, luật điểm) và thống kê.
const BL = require('./load');
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
function run(a, b, seed, fmt = 'one', opts = {}) {
  BL.setSeed(seed);
  const m = new BL.Match(Object.assign({ format: fmt, timeScale: 1, p0: { name: 'A', stats: a.stats || a, ctrl: 'bot', aggro: a.aggro }, p1: { name: 'B', stats: b.stats || b, ctrl: 'bot', aggro: b.aggro } }, opts));
  const R = { rallies: [], reasons: {}, shots: {}, contacts: 0, fails: 0, replays: 0, smashKmh: [], errors: [], points: 0, whiff: 0, landsOut: 0 };
  let lastPhase = m.phase, phaseStart = 0, steps = 0, ev0 = 0;
  while (m.phase !== 'over' && steps < 240 * 60 * 90) {
    m.step(); steps++;
    if (m.phase !== lastPhase) { lastPhase = m.phase; phaseStart = m.t; }
    if (m.phase === 'rally' ? m.t - m.shuttle.tHit > 12 : m.t - phaseStart > 25) { R.errors.push('STUCK in ' + m.phase + ' at ' + m.score.pts); break; }
    const sh = m.shuttle;
    if (!isFinite(sh.x + sh.y + sh.z)) { R.errors.push('NaN shuttle'); break; }
    for (const p of m.players) {
      if (p.y * p.side < 0.3) R.errors.push('player crossed net ' + p.idx);
      if (!isFinite(p.x + p.y)) { R.errors.push('NaN player'); break; }
    }
    if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
    while (ev0 < m.events.length) {
      const e = m.events[ev0++];
      if (e.type === 'hit') { R.shots[e.shot] = (R.shots[e.shot] || 0) + 1; if (e.shot === 'jsmash' || e.shot === 'smash') R.smashKmh.push(e.kmh); }
      if (e.type === 'contact') { R.contacts++; if (!e.ok) R.fails++; }
      if (e.type === 'replay') R.replays++;
      if (e.type === 'whiff') R.whiff++;
      if (e.type === 'land') { R.reasons[e.reason] = (R.reasons[e.reason] || 0) + 1; R.rallies.push(m.rally); }
      if (e.type === 'point') R.points++;
    }
    m.events.length = 0; ev0 = 0;
  }
  if (m.phase !== 'over') R.errors.push('not finished: ' + m.score.pts + ' phase ' + m.phase);
  R.score = m.score; R.winner = m.winner; R.time = m.t;
  return R;
}
module.exports = run;
if (require.main === module) {
  const pairs = [[30, 30], [60, 60], [90, 90], [30, 60], [60, 30], [40, 80]];
  for (const [a, b] of pairs) {
    let wins = 0, all = { rallies: [], reasons: {}, shots: {}, contacts: 0, fails: 0, replays: 0, smash: [], errs: [], time: 0, whiff: 0 };
    const N = 8;
    for (let i = 0; i < N; i++) {
      const r = run(lv(a), lv(b), 1000 + i * 17 + a * 3 + b);
      if (r.winner === 0) wins++;
      all.rallies.push(...r.rallies); all.contacts += r.contacts; all.fails += r.fails; all.replays += r.replays; all.smash.push(...r.smashKmh); all.errs.push(...r.errors); all.time += r.time; all.whiff += r.whiff;
      for (const k in r.reasons) all.reasons[k] = (all.reasons[k] || 0) + r.reasons[k];
      for (const k in r.shots) all.shots[k] = (all.shots[k] || 0) + r.shots[k];
    }
    const avg = all.rallies.reduce((s, x) => s + x, 0) / all.rallies.length;
    const sm = all.smash.length ? (all.smash.reduce((s, x) => s + x, 0) / all.smash.length).toFixed(0) : '-';
    console.log(`\n### ${a} vs ${b}: A thắng ${wins}/${N}, số cú/pha ${avg.toFixed(1)}, hỏng ${(all.fails / all.contacts * 100).toFixed(1)}%, tua ${all.replays}, hụt ${all.whiff}, đập TB ${sm} km/h, thời gian/trận ${(all.time / N / 60).toFixed(1)} phút`);
    console.log('  lý do:', JSON.stringify(all.reasons));
    console.log('  cú:', JSON.stringify(all.shots));
    if (all.errs.length) console.log('  LỖI:', [...new Set(all.errs)].slice(0, 8));
  }
}
