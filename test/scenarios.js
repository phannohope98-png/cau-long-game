// Bộ test tình huống có kiểm tra đúng/sai. Chạy: node test/scenarios.js
const BL = require('./load');
let pass = 0, fail = 0;
const ok = (cond, name, info) => { if (cond) pass++; else { fail++; console.log('  ✗ ' + name + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); } };
const sect = (s) => console.log('\n## ' + s);
const lv = (n) => { const o = {}; for (const s of BL.STATS) o[s.id] = n; return o; };
const C = BL.C;

// ---------------- 1. Vật lý ----------------
sect('Vật lý cầu');
{
  const f = BL.simulateFlight([0, -3, 30], [0, 0, 0], -1);
  const vEnd = f.pts[(f.n - 2) * 4 + 3];
  ok(Math.abs(vEnd - 6.8) < 0.05, 'rơi tự do đạt vận tốc giới hạn 6.8 m/s', vEnd);
  // đập 100 m/s: sau ~0.3 s còn < 30 m/s (giảm theo hàm mũ quãng đường)
  const g = BL.simulateFlight([0, -6, 2.8], [0, 100 * Math.cos(-0.2), 100 * Math.sin(-0.2)], -1);
  const k = Math.round(0.3 / C.DT);
  ok(g.pts[k * 4 + 3] < 30, 'đập 360 km/h giảm còn < 108 km/h sau 0.3 s', g.pts[k * 4 + 3] * 3.6);
  // quỹ đạo bất đối xứng: phần đi xuống dốc hơn phần đi lên
  const h = BL.simulateFlight([0, -6, 2.5], [0, 30, 30], -1);
  let apexK = 0; for (let i = 0; i < h.n; i++) if (h.pts[i * 4 + 2] > h.pts[apexK * 4 + 2]) apexK = i;
  const upRange = h.pts[apexK * 4 + 1] - -6, downRange = h.land.y - h.pts[apexK * 4 + 1];
  ok(downRange < upRange * 0.6, 'quỹ đạo bất đối xứng (rơi gần thẳng đứng)', { upRange, downRange });
  // cầu đâm lưới
  const n = BL.simulateFlight([0, -2, 1.0], [0, 15, 0], -1);
  ok(n.netHit && n.land.y < 0, 'cầu thấp đâm lưới, rơi phía người đánh', n.land);
  // cầu lọt dưới lưới cũng là lỗi
  const u = BL.simulateFlight([0, -1, 0.4], [0, 12, 0.5], -1);
  ok(u.netHit, 'cầu dưới mép lưới = lỗi', { net: u.netHit, under: u.underNet });
  // RK4 khớp bộ giải 2D (< 1 cm)
  let mx = 0;
  for (let i = 0; i < 200; i++) {
    const th = (-30 + BL.rand() * 100) * Math.PI / 180, v = 3 + BL.rand() * 90, z0 = 0.3 + BL.rand() * 2.8;
    const a = BL.fly2D(z0, v, th, 99, 1.5), f2 = BL.simulateFlight([0, -30, z0], [0, v * Math.cos(th), v * Math.sin(th)], -1);
    mx = Math.max(mx, Math.abs(f2.land.y + 30 - a.range));
  }
  ok(mx < 0.01, 'bộ giải quỹ đạo khớp mô phỏng', mx);
}

// ---------------- 2. Luật điểm ----------------
sect('Luật tính điểm BWF');
{
  let sc = BL.newScore('one');
  for (let i = 0; i < 20; i++) BL.addPoint(sc, 0);
  for (let i = 0; i < 20; i++) BL.addPoint(sc, 1);
  let e = BL.addPoint(sc, 0);
  ok(!e.gameOver, '21-20 chưa thắng (phải cách 2)');
  e = BL.addPoint(sc, 0);
  ok(e.gameOver && e.matchOver && e.matchWinner === 0, '22-20 thắng');
  sc = BL.newScore('one');
  for (let i = 0; i < 29; i++) { BL.addPoint(sc, 0); BL.addPoint(sc, 1); }
  ok(sc.pts[0] === 29 && sc.pts[1] === 29, '29-29');
  e = BL.addPoint(sc, 1);
  ok(e.gameOver && e.gameWinner === 1, '30-29 thắng (điểm trần)');
  sc = BL.newScore('one');
  let iv = 0;
  for (let i = 0; i < 11; i++) { const r = BL.addPoint(sc, 0); if (r.interval) iv++; }
  ok(iv === 1, 'nghỉ giữa ván khi chạm 11', iv);
  sc = BL.newScore('bwf');
  for (let g = 0; g < 2; g++) for (let i = 0; i < 21; i++) e = BL.addPoint(sc, g);
  ok(sc.games[0] === 1 && sc.games[1] === 1 && sc.gameNo === 3 && !e.matchOver, '1-1 ván -> ván 3');
  ok(sc.server === 1, 'người thắng ván trước giao trước ván sau', sc.server);
  // ô giao cầu theo điểm người giao
  sc = BL.newScore('one'); sc.server = 0;
  ok(BL.serveCourt(sc) === 'R', '0 điểm (chẵn) -> ô phải');
  BL.addPoint(sc, 0);
  ok(BL.serveCourt(sc) === 'L', '1 điểm (lẻ) -> ô trái');
  BL.addPoint(sc, 1);
  ok(sc.server === 1 && BL.serveCourt(sc) === 'L', 'bên thắng pha cầu giao; điểm 1 -> ô trái');
}

sect('Biên sân & ô giao cầu');
{
  const E = C.CORK_R;
  ok(BL.inSingles(2.59, -3, -1), 'chạm biên dọc là trong');
  ok(BL.inSingles(2.59 + E - 0.001, -3, -1), 'đế cầu chạm mép ngoài vạch là trong');
  ok(!BL.inSingles(2.59 + E + 0.002, -3, -1), 'qua mép ngoài 2 mm là ngoài');
  ok(!BL.inSingles(2.8, -3, -1), 'sân đơn: biên dọc đôi là ngoài');
  ok(BL.inSingles(0, -6.7, -1) && !BL.inSingles(0, -6.75, -1), 'biên cuối');
  // ô giao cầu: người nhận ở sân mình (side -1), ô phải của người nhận = x > 0
  ok(BL.inServiceBox(1.0, -3, -1, 'R'), 'cầu giao vào ô phải người nhận');
  ok(!BL.inServiceBox(-1.0, -3, -1, 'R'), 'cầu giao sai ô (không chéo)');
  ok(!BL.inServiceBox(1.0, -1.8, -1, 'R'), 'cầu giao ngắn trước vạch 1.98 m');
  ok(BL.inServiceBox(1.0, -1.98, -1, 'R'), 'cầu giao chạm vạch giao cầu gần là trong');
  ok(BL.inServiceBox(1.0, -6.65, -1, 'R'), 'đơn: giao sâu tới biên cuối là trong');
  ok(BL.inServiceBox(0.0, -3, -1, 'R') && BL.inServiceBox(0.0, -3, -1, 'L'), 'vạch giữa thuộc cả hai ô');
  ok(!BL.inServiceBox(2.7, -3, -1, 'R'), 'giao ra ngoài biên dọc đơn');
  // bên phải theo hướng nhìn của mỗi bên
  ok(BL.courtXSign(-1, 'R') === 1 && BL.courtXSign(1, 'R') === -1, 'ô phải mỗi bên nằm ở hai phía x ngược nhau (chéo)');
}

// ---------------- 3. Cú đánh theo vùng ----------------
sect('Cú đánh từng vùng (chỉ số 50)');
{
  const p = { side: -1, d: BL.derive(lv(50)), energy: 100, ctrl: 'bot' };
  const opp = { x: 0, y: 3.5 };
  const cases = [
    // [shot, điểm chạm, độ sâu kỳ vọng [min,max] tính từ lưới, thời gian bay kỳ vọng]
    ['net', [0.5, -1.0, 0.6], [0, 2.0], [0.5, 1.6]],
    ['crossnet', [1.4, -1.0, 0.7], [0, 2.2], [0.5, 1.6]],
    ['lift', [0.4, -1.0, 0.4], [4.3, 6.7], [1.2, 3.2]],
    ['drive', [1.5, -3.5, 1.3], [3.0, 6.7], [0.5, 1.4]],
    ['block', [1.0, -3.5, 0.7], [4.5, 6.7], [1.5, 3.0]],
    ['jsmash', [0.4, -3.8, 2.9], [2.0, 6.7], [0.2, 0.7]],
    ['drop', [0.4, -6.0, 2.5], [0.3, 3.2], [0.8, 1.6]],
    ['clear', [0.4, -6.0, 2.5], [4.8, 6.7], [1.5, 3.0]],
    ['kill', [0.3, -0.9, 2.1], [1.0, 6.7], [0.1, 0.5]],
    ['defend', [1.0, -3.8, 0.9], [0.3, 3.5], [0.6, 1.8]],
  ];
  for (const [shot, c, dr, tr] of cases) {
    let inn = 0, dOK = 0, tOK = 0;
    const N = 120;
    for (let i = 0; i < N; i++) {
      const pl = BL.planShot(p, c, shot, { opp, aimX: null, pressure: 0, stretch: 0.2 });
      const f = BL.simulateFlight(c, pl.v, -1);
      if (!f.netHit && BL.inSingles(f.land.x, f.land.y, 1)) {
        inn++;
        if (f.land.y >= dr[0] && f.land.y <= dr[1]) dOK++;
      }
      if (f.tFlight >= tr[0] && f.tFlight <= tr[1]) tOK++;
    }
    ok(inn / N > 0.85, `${shot}: ≥85% vào sân`, inn / N);
    ok(dOK / Math.max(1, inn) > 0.85, `${shot}: rơi đúng vùng ${dr}`, dOK / Math.max(1, inn));
    ok(tOK / N > 0.85, `${shot}: thời gian bay hợp lý ${tr}s`, tOK / N);
  }
  // đập nhanh hơn tạt, tạt nhanh hơn ve
  const sp = (s, c) => { let t = 0; for (let i = 0; i < 40; i++) t += BL.planShot(p, c, s, { opp, aimX: 0.5 }).speed; return t / 40; };
  ok(sp('jsmash', [0, -4, 2.9]) > sp('drive', [0, -4, 1.3]) && sp('drive', [0, -4, 1.3]) > sp('drop', [0, -6, 2.5]), 'tốc độ: đập > tạt > ve');
  // hướng đánh theo cần điều khiển
  let right = 0;
  for (let i = 0; i < 50; i++) { const pl = BL.planShot(p, [0, -5, 2.5], 'clear', { opp, aimX: 1 }); const f = BL.simulateFlight([0, -5, 2.5], pl.v, -1); if (f.land.x > 0.8) right++; }
  ok(right > 45, 'đẩy cần sang phải -> cầu sang phải', right);
}

sect('Đổi cú theo độ cao chạm cầu');
{
  const p = { side: -1, d: BL.derive(lv(50)) };
  ok(BL.adaptShot('jsmash', 1.2, 4, p) === 'drive', 'cầu ngang người: nhảy đập -> tạt');
  ok(BL.adaptShot('jsmash', 0.5, 4, p) === 'block', 'cầu thấp: nhảy đập -> đỡ');
  ok(BL.adaptShot('jsmash', 2.95, 4, p) === 'jsmash', 'cầu cao: nhảy đập');
  ok(BL.adaptShot('net', 2.2, 1, p) === 'kill', 'cầu bổng sát lưới khi bỏ nhỏ -> chụp lưới');
  ok(BL.adaptShot('clear', 0.5, 6, p) === 'lift', 'cầu thấp cuối sân: phông -> hất');
  ok(BL.adaptShot('drop', 0.5, 6, p) === 'net', 'cầu thấp: ve -> bỏ nhỏ');
}

// ---------------- 4. Chỉ số ----------------
sect('Chỉ số tăng đúng thứ cần tăng');
{
  const base = BL.derive(lv(40));
  const up = (id) => { const s = lv(40); s[id] = 80; return BL.derive(s); };
  ok(up('arm').smash > base.smash && up('wrist').smash > base.smash, 'cánh tay/cổ tay tăng tốc độ đập');
  ok(up('arm').smash - base.smash > up('wrist').smash - base.smash, 'cánh tay góp vào đập nhiều hơn cổ tay');
  ok(up('wrist').netClear < base.netClear, 'cổ tay: bỏ nhỏ sát lưới hơn');
  ok(up('flex').reach > base.reach && up('flex').jump > base.jump, 'dẻo dai: tầm với + bật nhảy');
  ok(up('tech').acc < base.acc && up('tech').sideMargin < base.sideMargin, 'kỹ thuật: ít sai số, đặt cầu sát vạch hơn');
  ok(up('foot').speed > base.speed && up('foot').accel > base.accel, 'tốc độ chân: chạy nhanh + tăng tốc');
  ok(up('react').reactTime < base.reactTime && up('react').defense > base.defense, 'phản ứng: khởi động nhanh + phòng thủ');
  ok(up('stamina').drain < base.drain && up('stamina').regen > base.regen, 'thể lực: hao chậm, hồi nhanh');
  // tỉ lệ đỡ phụ thuộc chênh lệch: cầu nhanh hơn -> khó đỡ hơn; phòng thủ cao -> dễ đỡ hơn
  const mk = (st) => ({ d: BL.derive(st), energy: 100, ctrl: 'bot', reachMul: 1 });
  const ctx = (v) => ({ vin: v, hd: 0.6, tAvail: 0.35, kind: 'net', z: 1 });
  ok(BL.contactOdds(mk(lv(40)), ctx(30)).prob < BL.contactOdds(mk(lv(40)), ctx(18)).prob, 'cầu tới nhanh hơn -> tỉ lệ đỡ thấp hơn');
  const dS = lv(40); dS.react = 90; dS.wrist = 80;
  ok(BL.contactOdds(mk(dS), ctx(30)).prob > BL.contactOdds(mk(lv(40)), ctx(30)).prob + 0.2, 'phòng thủ cao -> đỡ tốt hơn rõ rệt');
  const tired = mk(lv(40)); tired.energy = 10;
  ok(BL.contactOdds(tired, ctx(25)).prob < BL.contactOdds(mk(lv(40)), ctx(25)).prob, 'mệt -> đỡ kém hơn');
}

// ---------------- 5. Trận đấu: giao cầu, bộ pháp, chuỗi đánh ----------------
const newM = (a, b, o = {}) => new BL.Match(Object.assign({ format: 'one', timeScale: 1, p0: { name: 'A', stats: lv(a), ctrl: 'bot' }, p1: { name: 'B', stats: lv(b), ctrl: 'bot' } }, o));

sect('Giao cầu');
{
  BL.setSeed(11);
  let illegalH = 0, wrongBox = 0, serves = 0, posBad = 0;
  for (let g = 0; g < 4; g++) {
    const m = newM(50, 50);
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 240 * 600) {
      if (m.phase === 'serve' && m.phaseT < 1e-9 + C.DT) {
        const srv = m.players[m.score.server], rcv = m.opp(srv), rl = BL.serveCourt(m.score);
        // đứng đúng ô: người giao & người nhận chéo nhau
        if (Math.sign(srv.x) !== BL.courtXSign(srv.side, rl) || Math.sign(rcv.x) !== BL.courtXSign(rcv.side, rl)) posBad++;
        if (Math.sign(srv.x) === Math.sign(rcv.x)) posBad++;
      }
      const prevPhase = m.phase;
      m.step();
      if (prevPhase === 'serve' && m.phase === 'rally') {
        serves++;
        const srv = m.players[m.shuttle.hitter];
        if (srv.swing && srv.swing.c[2] > C.SERVE_MAX_H) illegalH++;
        const L = m.shuttle.flight.land;
        if (!m.shuttle.flight.netHit && BL.inSingles(L.x, L.y, -srv.side) && Math.sign(L.x) !== BL.courtXSign(-srv.side, m.shuttle.rl) && Math.abs(L.x) > 0.05) wrongBox++;
      }
      if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
    }
  }
  ok(serves > 80, 'có đủ lượt giao để kiểm tra', serves);
  ok(illegalH === 0, 'mọi cú giao chạm cầu dưới 1.15 m', illegalH);
  ok(posBad === 0, 'người giao/nhận đứng đúng ô chéo', posBad);
  ok(wrongBox / serves < 0.03, 'cầu giao hầu hết vào đúng ô chéo', wrongBox / serves);
}

sect('Bộ pháp: đuổi theo từng loại cú');
{
  // bot B (60) phải tới kịp: ve sát lưới, phông sâu, cầu chéo, tạt; đo tỉ lệ chạm được
  const reach = {};
  for (const shot of ['drop', 'clear', 'net', 'crossnet', 'drive', 'lift', 'jsmash']) {
    let got = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      BL.setSeed(100 + i);
      const m = newM(60, 60);
      const a = m.players[0], b = m.players[1];
      m.phase = 'rally';
      a.x = (BL.rand() - 0.5) * 2; a.y = shot === 'net' || shot === 'crossnet' || shot === 'lift' ? -1.2 : shot === 'drive' ? -3.6 : -5.6;
      b.x = 0; b.y = 3.5; b.holding = false;
      const c = [a.x + 0.3, a.y + 0.3, shot === 'jsmash' ? 2.9 : shot === 'drive' ? 1.3 : shot === 'clear' || shot === 'drop' ? 2.5 : 0.6];
      const pl = BL.planShot(a, c, shot, { opp: b, aimX: BL.rand() < 0.5 ? -0.9 : 0.9 });
      m.launch(a, c, pl, false);
      if (m.shuttle.flight.netHit || !BL.inSingles(m.shuttle.flight.land.x, m.shuttle.flight.land.y, 1)) continue;
      n++;
      let hit = false;
      for (let s = 0; s < 240 * 4 && m.phase === 'rally'; s++) { m.step(); if (m.shuttle.hitter === 1) { hit = true; break; } }
      if (hit) got++;
    }
    reach[shot] = n ? got / n : 0;
  }
  ok(reach.clear > 0.95 && reach.lift > 0.95, 'luôn kịp chạy về cuối sân với cầu cao', reach);
  ok(reach.drop > 0.85 && reach.net > 0.85, 'kịp lên lưới đỡ ve/bỏ nhỏ', reach);
  ok(reach.crossnet > 0.7, 'kéo cầu chéo khó hơn nhưng phần lớn vẫn tới', reach.crossnet);
  ok(reach.jsmash < reach.clear, 'nhảy đập khó đỡ hơn phông', reach);
  console.log('   tỉ lệ chạy tới & chạm được:', Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, Math.round(v * 100) + '%'])));
}

sect('Chuỗi phối hợp: phông → đập → đỡ → bỏ nhỏ → hất');
{
  // ép bot dùng chuỗi cú định sẵn, kiểm tra trận không vỡ và cầu luân phiên đúng bên
  const seq = ['clear', 'jsmash', 'block', 'net', 'lift', 'drop', 'net', 'crossnet', 'lift', 'jsmash', 'defend', 'drive', 'drive', 'clear'];
  const orig = BL.AI.chooseShot;
  let i = 0;
  BL.AI.chooseShot = () => ({ shot: seq[i++ % seq.length], aimX: 0 });
  let alt = true, hits = 0, rallies = 0;
  BL.setSeed(42);
  const m = newM(85, 85);
  let last = -1;
  for (let s = 0; s < 240 * 240 && m.phase !== 'over'; s++) {
    m.step();
    if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
    for (const e of m.events.splice(0)) {
      if (e.type === 'hit') { if (!e.serve && e.who === last) alt = false; last = e.who; hits++; }
      if (e.type === 'servePos') last = -1;
      if (e.type === 'land') rallies++;
    }
  }
  BL.AI.chooseShot = orig;
  ok(alt, 'hai bên đánh luân phiên (không ai chạm cầu 2 lần)');
  ok(hits / Math.max(1, rallies) > 3, 'chuỗi phối hợp tạo pha cầu dài', hits / Math.max(1, rallies));
}

sect('Người chơi: bấm sai lúc / đổi cú / bấm loạn / không bấm');
{
  BL.setSeed(5);
  const m = new BL.Match({ format: 'one', timeScale: 1, reflex: true, p0: { name: 'H', stats: lv(50), ctrl: 'human' }, p1: { name: 'B', stats: lv(50), ctrl: 'bot' }, firstServer: 0 });
  // bấm cú đánh thường khi đang giao -> không được giao
  m.press(0, 'drive');
  for (let s = 0; s < 240; s++) m.step();
  ok(m.phase === 'serve', 'bấm nút rally lúc giao cầu không làm giao bậy');
  m.press(0, 'serve_short');
  for (let s = 0; s < 240 && m.phase === 'serve'; s++) m.step();
  ok(m.phase === 'rally' && m.shuttle.serve, 'bấm Giao ngắn -> giao cầu');
  // đổi cú trong lúc vung (trước khi chạm)
  BL.setSeed(6);
  const m2 = new BL.Match({ format: 'one', timeScale: 1, p0: { name: 'H', stats: lv(50), ctrl: 'human' }, p1: { name: 'B', stats: lv(50), ctrl: 'bot' }, firstServer: 1 });
  const me = m2.players[0];
  let changed = false;
  for (let s = 0; s < 240 * 20 && !changed; s++) {
    if (m2.phase === 'rally' && m2.shuttle.hitter === 1 && !me.swing && !me.intent) m2.press(0, 'lift');
    // tự chạy tới cầu cho người
    if (m2.phase === 'rally' && m2.shuttle.hitter === 1) { const t = BL.AI.intercept(me, m2, 0); const dx = t.x - me.x, dy = t.y - me.y, d = Math.hypot(dx, dy); me.input.mx = d > 0.1 ? dx / d : 0; me.input.my = d > 0.1 ? dy / d : 0; }
    if (me.swing && !me.swing.hit && me.swing.t < me.swing.tc - 0.06 && me.swing.kind === 'lift') { m2.press(0, 'block'); changed = me.swing.shot === 'block'; }
    m2.step();
    if (m2.phase === 'dead' || m2.phase === 'replay') { m2.events.length = 0; }
  }
  ok(changed, 'đổi cú cùng tư thế khi đang vung được chấp nhận');
  // không bấm gì: cầu nhanh -> tự đỡ phản xạ
  // không bấm gì, bị đập thẳng vào người -> tự đỡ phản xạ
  let reflexN = 0, tries = 0;
  for (let i = 0; i < 30; i++) {
    BL.setSeed(800 + i);
    const m3 = new BL.Match({ format: 'quick', timeScale: 1, reflex: true, p0: { name: 'H', stats: lv(60), ctrl: 'human' }, p1: Object.assign({ ctrl: 'bot' }, BL.OPPONENTS[2]) });
    const h = m3.players[0], b = m3.players[1];
    m3.phase = 'rally'; b.holding = false; h.holding = false;
    h.x = 0.3; h.y = -3.5; b.x = 0.2; b.y = 4.5;
    const c = [0.3, 4.3, 2.9];
    m3.launch(b, c, BL.planShot(b, c, 'jsmash', { opp: { x: 2, y: -3 }, aimX: 0.1 }), false);
    if (m3.shuttle.flight.netHit) continue;
    tries++;
    for (let s = 0; s < 240 * 2 && m3.phase === 'rally'; s++) { m3.step(); for (const e of m3.events.splice(0)) if (e.type === 'contact' && e.reflex) reflexN++; }
  }
  ok(reflexN / tries > 0.6, 'không bấm: vẫn tự đỡ phản xạ khi bị đập vào người', [reflexN, tries]);
  // tắt phản xạ: cầu đập vào người mà không bấm -> mất điểm
  BL.setSeed(820);
  const m5 = new BL.Match({ format: 'quick', timeScale: 1, reflex: false, p0: { name: 'H', stats: lv(60), ctrl: 'human' }, p1: { name: 'B', stats: lv(60), ctrl: 'bot' } });
  m5.phase = 'rally'; m5.players[1].holding = false; m5.players[0].holding = false; m5.players[0].x = 0.3; m5.players[0].y = -3.5;
  m5.launch(m5.players[1], [0.3, 4.3, 2.9], BL.planShot(m5.players[1], [0.3, 4.3, 2.9], 'jsmash', { opp: { x: 2, y: -3 }, aimX: 0.1 }), false);
  let hitBy0 = false;
  for (let s = 0; s < 240 * 2 && m5.phase === 'rally'; s++) { m5.step(); if (m5.shuttle.hitter === 0) hitBy0 = true; }
  ok(!hitBy0, 'tắt tự đỡ + không bấm -> không vung vợt');
  // bấm loạn liên tục không làm vỡ trận
  BL.setSeed(9);
  const m4 = new BL.Match({ format: 'quick', timeScale: 1, p0: { name: 'H', stats: lv(40), ctrl: 'human' }, p1: { name: 'B', stats: lv(40), ctrl: 'bot' } });
  let bad = 0;
  for (let s = 0; s < 240 * 600 && m4.phase !== 'over'; s++) {
    if (s % 7 === 0) { const b = m4.buttons(0); m4.press(0, b[s % 3]); }
    m4.players[0].input.mx = Math.sin(s / 50); m4.players[0].input.my = Math.cos(s / 70);
    m4.step();
    if (m4.phase === 'interval' || m4.phase === 'gamebreak') m4.skipBreak = true;
    m4.events.length = 0;
    const p = m4.players[0];
    if (p.y > -0.37 || !isFinite(p.x)) bad++;
  }
  ok(m4.phase === 'over', 'bấm loạn + chạy loạn: trận vẫn kết thúc bình thường', m4.phase);
  ok(bad === 0, 'không bao giờ chạm/qua lưới', bad);
}

sect('Mắt diều hâu');
{
  BL.setSeed(3);
  let rp = 0, wrong = 0;
  for (let g = 0; g < 6; g++) {
    const m = newM(70, 70);
    for (let s = 0; s < 240 * 1200 && m.phase !== 'over'; s++) {
      m.step();
      if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true;
      for (const e of m.events.splice(0)) {
        if (e.type === 'replay') {
          rp++;
          const lp = m.lastPoint, sh = m.shuttle, L = sh.flight.land, other = m.opp(m.players[sh.hitter]);
          const inside = sh.serve ? BL.inServiceBox(L.x, L.y, other.side, sh.rl) : BL.inSingles(L.x, L.y, other.side);
          if (inside !== e.inside || (inside ? lp.winner !== sh.hitter : lp.winner === sh.hitter)) wrong++;
          if (Math.abs(e.m) >= 0.08) wrong++;
          if (!m.replay.frames.length || m.replay.dur < m.replay.intro + m.replay.play) wrong++;
        }
      }
    }
  }
  ok(rp > 3, 'có pha cầu sát vạch được tua lại', rp);
  ok(wrong === 0, 'kết luận TRONG/NGOÀI & điểm khớp luật', wrong);
}

sect('Thể thức & bền vững');
{
  for (const fmt of ['quick', 'one', 'bwf']) {
    BL.setSeed(77);
    const m = newM(55, 55, { format: fmt });
    let s = 0;
    for (; s < 240 * 3600 && m.phase !== 'over'; s++) { m.step(); if (m.phase === 'interval' || m.phase === 'gamebreak') m.skipBreak = true; m.events.length = 0; }
    const f = BL.FORMATS[fmt];
    const need = Math.ceil(f.games / 2);
    ok(m.phase === 'over' && m.score.games[m.winner] === need, `${fmt}: kết thúc đúng số ván`, m.score.games);
    ok(m.hist.length <= 400, 'bộ nhớ tua lại giới hạn', m.hist.length);
    for (const h of m.score.history) {
      const [a, b] = h, w = Math.max(a, b), l = Math.min(a, b);
      ok((w >= f.points && w - l >= 2) || w === f.cap, `${fmt}: tỉ số ván hợp lệ ${a}-${b}`);
    }
  }
}

console.log(`\n==== ${pass} đạt, ${fail} lỗi ====`);
process.exitCode = fail ? 1 : 0;
