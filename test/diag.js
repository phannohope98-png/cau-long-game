const BL = require('./load');
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
const L = +process.argv[2] || 60;
const agg = {}; const outBy = {}; const netBy = {}; const winBy = {}; const sideW = [0, 0]; const leaveWin = [0, 0];
for (let g = 0; g < 6; g++) {
  BL.setSeed(500 + g);
  const m = new BL.Match({ format: 'one', timeScale: 1, p0: { name: 'A', stats: lv(L), ctrl: 'bot' }, p1: { name: 'B', stats: lv(L), ctrl: 'bot' } });
  let lastHit = null; let ev0 = 0;
  while (m.phase !== 'over' && m.t < 4000) {
    m.step();
    if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
    for (; ev0 < m.events.length; ev0++) {
      const e = m.events[ev0];
      if (e.type === 'hit') lastHit = e;
      if (e.type === 'land') {
        const hitter = m.players[m.shuttle.hitter], rcv = m.opp(hitter);
        const k = lastHit.shot + (lastHit.serve ? '(s)' : '');
        if (m.shuttle.flight.netHit) netBy[k] = (netBy[k] || 0) + 1;
        else if (e.winner === hitter.idx) {
          const dist = Math.hypot(rcv.x - e.x, rcv.y - e.y);
          const key = k + (rcv.leave ? ' LEAVE' : dist < rcv.d.reach ? ' near' : ' far');
          winBy[key] = (winBy[key] || 0) + 1;
          if (rcv.leave) leaveWin[hitter.idx]++;
        }
        else { const kk = k + ' ' + (e.reason.includes('dọc') ? 'side' : 'long'); outBy[kk] = (outBy[kk] || 0) + 1; }
        sideW[e.winner]++;
      }
    }
    m.events.length = 0; ev0 = 0;
  }
}
console.log('net by shot', netBy); console.log('winners by shot/rcv', winBy); console.log('out by', outBy); console.log('points by side', sideW, 'leave-lost', leaveWin);
