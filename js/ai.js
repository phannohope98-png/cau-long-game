// Bot: phán đoán đường cầu, chạy tới điểm đánh, chọn cú đánh theo tình huống và lối chơi.
(function (G) {
  const BL = G.BL;
  const C = BL.C;
  const AI = (BL.AI = {});

  // Vị trí chờ (base) trong đánh đơn: giữa sân, nhích về phía cú đánh vừa đi
  AI.base = function (p, m) {
    const s = p.side;
    let bx = 0, by = s * 3.55;
    const sh = m.shuttle;
    if (sh && sh.flight && sh.hitter === p.idx && sh.flight.land) {
      // vừa đánh đi: lùi về giữa, lệch nhẹ về hướng cầu đi (góc trả về rộng nhất)
      bx = BL.clamp(sh.flight.land.x * 0.18, -0.5, 0.5);
      const ld = Math.abs(sh.flight.land.y);
      // vừa bỏ nhỏ -> áp sát lưới chờ vồ; vừa ve -> nhích lên; cầu sâu -> giữa sân
      by = s * (ld < 1.6 ? 2.0 : ld < 3 ? 2.9 : 3.6);
    }
    return { x: bx, y: by };
  };

  // Tìm điểm chạm sớm nhất bot kịp chạy tới (đường cầu là mảng điểm xác định trước)
  AI.intercept = function (p, m, delay) {
    const f = m.shuttle.flight, pts = f.pts;
    const d = p.d, s = p.side;
    const top = d.reachUp + d.jump * 0.85;
    const vRun = d.speed * p.fatigue() * 0.85;
    for (let k = m.shuttle.pi; k < f.n; k += 3) {
      const x = pts[k * 4], y = pts[k * 4 + 1], z = pts[k * 4 + 2];
      if (y * s < 0.25 || z < 0.18 || z > top) continue;
      const t = (k - m.shuttle.pi) * C.DT - delay;
      if (t < 0) continue;
      const dist = Math.hypot(x - p.x, y - p.y);
      const travel = Math.max(0, dist - BL.reachAt(d, z) * 0.75);
      const need = travel / vRun + (travel > 0 ? 0.08 : 0);
      if (need <= t) {
        // đứng sao cho cầu ở phía tay thuận, cách thân ~0.5 tầm với
        const ux = dist > 1e-3 ? (x - p.x) / dist : 0, uy = dist > 1e-3 ? (y - p.y) / dist : 0;
        const keep = Math.min(dist, BL.reachAt(d, z) * 0.55);
        return { x: x - ux * keep, y: y - uy * keep, k, z, t };
      }
    }
    const L = f.land;
    return { x: L.x, y: L.y, k: f.n - 1, z: 0, t: 99, late: true };
  };

  // Phán đoán cầu ra ngoài (bỏ cầu) — sai số theo kỹ thuật
  AI.judgeOut = function (p, m) {
    const sh = m.shuttle, f = sh.flight;
    if (f.netHit) return true;
    const L = f.land;
    if (L.y * p.side <= 0) return true;
    const lm = BL.lineMargin(L.x, L.y, p.side, sh.serve ? { rl: sh.rl } : null);
    const est = lm.m + BL.gauss() * p.d.judge * 0.35;
    // cầu càng cao (thời gian nhìn lâu) càng phán đoán chuẩn
    return est < -0.05;
  };

  // Chọn cú đánh. c: điểm chạm, opp: đối thủ
  AI.chooseShot = function (p, m, c, opp) {
    const ay = Math.abs(c[1]), z = c[2];
    const zone = BL.zoneOf(c[1]);
    const ag = p.aggro !== undefined ? p.aggro : 0.5;
    const oppDeep = Math.abs(opp.y) > 4.6, oppFront = Math.abs(opp.y) < 2.6;
    const tired = p.energy < 25;
    const r = BL.rand();
    let shot;
    if (z >= 2.05) {
      if (zone === 'front') shot = 'kill';
      else if (zone === 'mid') shot = r < ag * 0.7 + 0.25 && !tired ? 'jsmash' : r < 0.8 ? 'drop' : 'clear';
      else {
        const pS = tired ? ag * 0.15 : ag * 0.42;
        const pD = oppDeep ? 0.5 : 0.3;
        shot = r < pS ? 'jsmash' : r < pS + pD ? 'drop' : 'clear';
      }
    } else if (z >= 1.05) {
      if (zone === 'front') shot = z > BL.netHeight(c[0]) + 0.12 && ay < 1.9 ? 'kill' : r < 0.45 ? 'net' : r < 0.65 ? 'crossnet' : r < 0.8 ? 'push' : 'lift';
      else shot = r < 0.45 + ag * 0.2 ? 'drive' : r < 0.8 ? 'block' : 'defend';
    } else {
      if (zone === 'front') shot = oppFront ? (r < 0.6 ? 'lift' : r < 0.8 ? 'push' : 'net') : r < 0.45 ? 'net' : r < 0.65 ? 'crossnet' : r < 0.72 ? 'push' : 'lift';
      else shot = r < 0.6 ? 'block' : 'defend';
    }
    // lối chơi riêng của từng đối thủ: đổi một phần lựa chọn theo sở trường
    const r2 = BL.rand();
    switch (p.play) {
      case 'net': // thích bỏ nhỏ, ve
        if (z >= 2.05 && zone !== 'front' && r2 < 0.45) shot = 'drop';
        else if (zone === 'front' && z < 1.4 && r2 < 0.5) shot = r2 < 0.3 ? 'net' : 'crossnet';
        else if (zone !== 'front' && z < 1.05 && r2 < 0.4) shot = 'defend';
        break;
      case 'clear': // đánh phong trào: phông/hất nhiều
        if (z >= 2.05 && zone === 'back' && r2 < 0.5) shot = 'clear';
        else if (z < 1.05 && r2 < 0.5) shot = zone === 'front' ? 'lift' : 'block';
        break;
      case 'defend': // thủ chắc: đánh cao sâu, chờ đối thủ hỏng
        if (z >= 2.05 && zone === 'back' && r2 < 0.4) shot = 'clear';
        else if (z < 2.05 && zone !== 'front' && r2 < 0.45) shot = 'block';
        break;
      case 'drive': // tạt nhanh, ép sát
        if (z >= 0.9 && z < 2.2 && zone !== 'front' && r2 < 0.6) shot = 'drive';
        else if (zone === 'front' && z < 1.4 && r2 < 0.35) shot = 'net';
        break;
      case 'smash': // thấy cầu cao là đập
        if (z >= 2.05 && zone !== 'front' && !tired && r2 < 0.45) shot = 'jsmash';
        break;
    }
    // đánh vào chỗ trống: ngược phía đối thủ, đôi khi đánh trả ngược (wrong-foot)
    let side = Math.abs(opp.x) > 0.3 ? -Math.sign(opp.x) : BL.rand() < 0.5 ? -1 : 1;
    if (BL.rand() < 0.18) side = -side;
    const aimX = side * (0.55 + BL.rand() * 0.45);
    return { shot, aimX };
  };

  AI.chooseServe = function (p) {
    const r = BL.rand();
    const lowLevel = p.d.control < 45;
    if (lowLevel) return r < 0.45 ? 'serve_short' : r < 0.95 ? 'serve_high' : 'serve_flick';
    return r < 0.6 ? 'serve_short' : r < 0.9 ? 'serve_high' : 'serve_flick';
  };
})(typeof window !== 'undefined' ? window : globalThis);
