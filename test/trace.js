const BL = require('./load');
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
BL.setSeed(77);
const m = new BL.Match({ format: 'one', timeScale: 1, p0: { name: 'A', stats: lv(60), ctrl: 'bot' }, p1: { name: 'B', stats: lv(60), ctrl: 'bot' } });
let ev0 = 0, shown = 0, cur = null;
const f2 = (v) => v.toFixed(2);
while (m.phase !== 'over' && shown < 8) {
  m.step();
  if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
  for (; ev0 < m.events.length; ev0++) {
    const e = m.events[ev0];
    if (e.type === 'hit') {
      const d = m.opp(m.players[e.who]);
      const fl = m.shuttle.flight;
      cur = { shot: e.shot, from: [f2(e.x), f2(e.y), f2(e.z)], def: [f2(d.x), f2(d.y)], land: [f2(fl.land.x), f2(fl.land.y)], t: f2(fl.tFlight), react: f2(d.reactT) };
    }
    if (e.type === 'land' && cur && cur.shot === 'jsmash' && e.winner === m.shuttle.hitter) {
      const d = m.opp(m.players[m.shuttle.hitter]);
      console.log(JSON.stringify(cur), 'def end', f2(d.x), f2(d.y), 'target', d.target && [f2(d.target.x), f2(d.target.y), d.target.late], 'reach', f2(d.d.reach));
      shown++;
    }
  }
  m.events.length = 0; ev0 = 0;
}
