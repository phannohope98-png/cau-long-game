const BL = require('./load');
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
const orig = BL.contactOdds;
let log = [];
BL.contactOdds = function (p, ctx) { const r = orig(p, ctx); if (p.ctrl === 'human') log.push({ ...ctx, prob: r.prob, diff: r.diff, skill: r.skill, st: r.stretch, e: p.energy }); return r; };
BL.setSeed(905);
const m = new BL.Match({ format: 'quick', timeScale: 1, p0: { name: 'H', stats: lv(30), ctrl: 'human' }, p1: Object.assign({ ctrl: 'bot' }, BL.OPPONENTS[1]) });
const me = m.players[0]; let pf = -1;
while (m.phase !== 'over' && m.t < 900) {
  const sh = m.shuttle; let tgt = null;
  if (m.phase === 'rally' && sh.hitter === 1 && m.t - sh.tHit > 0.25) tgt = BL.AI.intercept(me, m, 0);
  if (tgt) { const dx = tgt.x - me.x, dy = tgt.y - me.y, d = Math.hypot(dx, dy); me.input.mx = d > 0.1 ? dx / d : 0; me.input.my = d > 0.1 ? dy / d : 0; } else { me.input.mx = me.input.my = 0; }
  if (m.phase === 'serve' && m.score.server === 0 && m.phaseT > 0.5 && !me.swing) m.press(0, 'serve_high');
  if (m.phase === 'rally' && sh.hitter === 1 && pf !== sh.tHit && m.t - sh.tHit > 0.25) { pf = sh.tHit; const b = m.buttons(0); m.press(0, b[Math.floor(BL.rand() * 3)]); }
  m.step(); if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
}
const bad = log.filter((l) => l.prob < 0.8);
console.log('contacts', log.length, 'avg prob', (log.reduce((a, l) => a + l.prob, 0) / log.length).toFixed(2), 'low', bad.length);
for (const l of bad.slice(0, 15)) console.log(l.kind, 'vin', l.vin.toFixed(1), 'hd', l.hd.toFixed(2), 'st', l.st.toFixed(2), 'tAv', l.tAvail.toFixed(2), 'z', l.z.toFixed(2), 'skill', l.skill.toFixed(0), 'diff', l.diff.toFixed(0), 'p', l.prob.toFixed(2), 'E', l.e.toFixed(0));
