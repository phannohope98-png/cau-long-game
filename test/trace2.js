const BL = require('./load');
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
BL.setSeed(901);
const m = new BL.Match({ format: 'quick', timeScale: 1, p0: { name: 'H', stats: lv(60), ctrl: 'human' }, p1: Object.assign({ ctrl: 'bot' }, BL.OPPONENTS[1]) });
const me = m.players[0];
const orig = m.launch.bind(m);
let shown = 0;
m.launch = function (p, c, plan, srv) {
  orig(p, c, plan, srv);
  const f = m.shuttle.flight;
  if (p.idx === 0 && (f.netHit || f.land.y * p.side > 0) && shown < 12) {
    shown++;
    console.log(plan.shot, 'c', c.map((v) => v.toFixed(2)).join(','), 'v', plan.v.map((v) => v.toFixed(1)).join(','), 'tgt', plan.target && plan.target.map((v) => v.toFixed(2)).join(','),
      'plan', plan.plan ? `th ${(plan.plan.theta * 57.3).toFixed(1)} sp ${plan.plan.speed.toFixed(1)} clr ${plan.plan.res.clear.toFixed(2)} short ${plan.plan.short}` : '', 'net', f.netHit, 'under', f.underNet, 'land', f.land.y.toFixed(2), 'face', me.face.toFixed(2));
  }
};
let pf = -1, ev0 = 0;
while (m.phase !== 'over' && m.t < 1500) {
  const sh = m.shuttle;
  let tgt = null;
  if (m.phase === 'rally' && sh.hitter === 1 && m.t - sh.tHit > 0.25) tgt = BL.AI.intercept(me, m, 0);
  if (tgt) { const dx = tgt.x - me.x, dy = tgt.y - me.y, d = Math.hypot(dx, dy); me.input.mx = d > 0.1 ? dx / d : 0; me.input.my = d > 0.1 ? dy / d : 0; } else { me.input.mx = me.input.my = 0; }
  me.input.aimX = 0;
  if (m.phase === 'serve' && m.score.server === 0 && m.phaseT > 0.5 && !me.swing) m.press(0, 'serve_high');
  if (m.phase === 'rally' && sh.hitter === 1 && pf !== sh.tHit && m.t - sh.tHit > 0.25) { pf = sh.tHit; const b = m.buttons(0); m.press(0, b[Math.floor(BL.rand() * 3)]); }
  m.step();
  if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
}
