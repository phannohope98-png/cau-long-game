// Giả lập người chơi thật: chỉ dùng cần điều khiển + 3 nút (không autoMove/autoHit), kiểu bấm khác nhau.
const BL = require('./load');
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
// style: 'smart' (đúng nút hợp lý), 'random' (bấm bừa), 'late' (bấm trễ), 'spam' (bấm liên tục), 'idle' (không bấm -> test phản xạ)
function play(style, myLv, oppIdx, seed, opts = {}) {
  BL.setSeed(seed);
  const o = BL.OPPONENTS[oppIdx];
  const m = new BL.Match(Object.assign({ format: 'quick', timeScale: 1, reflex: true,
    p0: { name: 'Human', stats: lv(myLv), ctrl: 'human' }, p1: Object.assign({ ctrl: 'bot' }, o) }, opts));
  const me = m.players[0];
  const R = { whiff: 0, presses: 0, hits: 0, reflex: 0, errs: [], ends: {}, conv: 0 };
  let ev0 = 0, pressedFor = -1, target = null, planned = -1, rnd = 0;
  while (m.phase !== 'over' && m.t < 1500) {
    // ---- "ngón tay trái": kéo cần về phía điểm đánh dự đoán ----
    const sh = m.shuttle;
    if (m.phase === 'rally' && sh.hitter === 1 && sh.flight) {
      if (planned !== sh.tHit && m.t - sh.tHit > me.d.reactTime + 0.1) { planned = sh.tHit; target = BL.AI.intercept(me, m, 0); rnd = BL.rand(); }
    } else if (m.phase === 'rally' && sh.hitter === 0) target = { x: 0, y: -3.4 };
    let mx = 0, my = 0;
    if (target && m.phase === 'rally') {
      const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy);
      if (d > 0.12) { mx = dx / d; my = dy / d; }
    }
    me.input.mx = mx; me.input.my = my; me.input.aimX = mx;
    // ---- "ngón tay phải": bấm nút ----
    if (m.phase === 'serve' && m.score.server === 0 && m.phaseT > 0.6 && !me.swing) {
      const b = m.buttons(0); m.press(0, b[Math.floor(BL.rand() * 4)]); R.presses++;
    }
    if (m.phase === 'rally' && sh.hitter === 1 && style !== 'idle') {
      const tIn = m.t - sh.tHit;
      const wantT = style === 'late' ? 0.55 : 0.25;
      if (pressedFor !== sh.tHit && tIn > wantT) {
        pressedFor = sh.tHit;
        const b = m.buttons(0);
        let i = Math.floor(BL.rand() * 4);
        if (style === 'smart') { const z = m.zone(0); i = z === 'back' ? (rnd < 0.35 ? 1 : rnd < 0.6 ? 0 : rnd < 0.8 ? 3 : 2) : z === 'mid' ? (rnd < 0.35 ? 2 : rnd < 0.55 ? 0 : rnd < 0.75 ? 1 : 3) : z === 'kill' ? 0 : (rnd < 0.45 ? 0 : rnd < 0.6 ? 1 : rnd < 0.7 ? 2 : 3); }
        m.press(0, b[i]); R.presses++;
      }
      if (style === 'spam' && Math.floor(m.t * 20) % 3 === 0) { const b = m.buttons(0); m.press(0, b[Math.floor(BL.rand() * 3)]); R.presses++; }
    }
    m.step();
    if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
    if (!isFinite(me.x + me.y + sh.x + sh.y + sh.z)) { R.errs.push('NaN'); break; }
    if (m.phase === 'rally' && m.t - sh.tHit > 12) { R.errs.push('stuck'); break; }
    for (; ev0 < m.events.length; ev0++) {
      const e = m.events[ev0];
      if (e.type === 'whiff' && e.who === 0) R.whiff++;
      if (e.type === 'contact' && e.who === 0) { R.hits++; if (e.reflex) R.reflex++; if (e.shot !== e.wanted && e.shot !== 'mishit') R.conv++; }
      if (e.type === 'hit') R.last = e.shot; if (e.type === 'land') { const k = (e.winner === 0 ? 'W:' : 'L:') + e.reason + '/' + R.last; R.ends[k] = (R.ends[k] || 0) + 1; }
    }
    if (m.events.length > 150) { m.events.splice(0, ev0); ev0 = 0; }
  }
  if (m.phase !== 'over') R.errs.push('unfinished ' + m.score.pts);
  R.score = m.score.history[0] || m.score.pts;
  return R;
}
const cases = [['smart', 30, 0], ['smart', 30, 1], ['smart', 50, 2], ['smart', 70, 4], ['random', 30, 0], ['late', 40, 0], ['spam', 40, 1], ['idle', 40, 0]];
for (const [st, l, oi] of cases) {
  let tot = { w: 0, l: 0, whiff: 0, hits: 0, reflex: 0, conv: 0, errs: [], ends: {} };
  for (let i = 0; i < 5; i++) {
    const r = play(st, l, oi, 900 + i * 13);
    tot.w += r.score[0]; tot.l += r.score[1]; tot.whiff += r.whiff; tot.hits += r.hits; tot.reflex += r.reflex; tot.conv += r.conv; tot.errs.push(...r.errs);
    for (const k in r.ends) tot.ends[k] = (tot.ends[k] || 0) + r.ends[k];
  }
  console.log(`\n[${st} lv${l} vs ${BL.OPPONENTS[oi].name}] điểm ${tot.w}-${tot.l}, chạm ${tot.hits}, phản xạ ${tot.reflex}, đổi cú ${tot.conv}, hụt ${tot.whiff}`, tot.errs.length ? 'LỖI ' + tot.errs : '');
  console.log('  ', JSON.stringify(tot.ends));
}
