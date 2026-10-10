// Các cú đánh: chọn điểm đích, giải quỹ đạo (vật lý thật) ra vận tốc rời vợt, cộng sai số theo chỉ số.
(function (G) {
  const BL = G.BL;
  const C = BL.C;
  const D2R = Math.PI / 180;

  BL.SHOTS = {
    net: { name: 'Bỏ nhỏ', icon: '🪶', kind: 'net', sig: [1.3, 2.0, 0.018], cost: 2 },
    crossnet: { name: 'Kéo cầu chéo', icon: '↗', kind: 'net', sig: [1.5, 2.6, 0.022], cost: 2 },
    lift: { name: 'Hất cầu', icon: '⤴', kind: 'lift', sig: [1.5, 1.8, 0.03], cost: 3 },
    drive: { name: 'Tạt ngang', icon: '➟', kind: 'drive', sig: [1.0, 1.6, 0.03], cost: 3 },
    block: { name: 'Đỡ cầu bật lên', icon: '🛡', kind: 'lift', sig: [1.8, 2.2, 0.035], cost: 2 },
    jsmash: { name: 'Nhảy đập', icon: '💥', kind: 'smash', sig: [0.8, 1.4, 0.02], cost: 9 },
    drop: { name: 'Ve cầu', icon: '🍃', kind: 'drop', sig: [1.0, 1.6, 0.03], cost: 3 },
    clear: { name: 'Phông cầu', icon: '🌈', kind: 'clear', sig: [1.2, 1.6, 0.025], cost: 4 },
    kill: { name: 'Chụp lưới', icon: '⚡', kind: 'smash', sig: [1.2, 2.0, 0.03], cost: 4 },
    defend: { name: 'Đỡ phản xạ', icon: '✋', kind: 'net', sig: [2.0, 3.0, 0.03], cost: 2 },
    smash: { name: 'Đập cầu', icon: '💥', kind: 'smash', sig: [0.8, 1.4, 0.02], cost: 6 },
    serve_short: { name: 'Giao ngắn', icon: '🪶', kind: 'serve', sig: [1.0, 1.2, 0.02], cost: 1 },
    serve_high: { name: 'Giao cao sâu', icon: '🌈', kind: 'serve', sig: [1.1, 1.5, 0.025], cost: 1 },
    serve_flick: { name: 'Giao bổng nhanh', icon: '➚', kind: 'serve', sig: [1.0, 1.5, 0.025], cost: 1 },
    mishit: { name: 'Đánh hỏng', icon: '✖', kind: 'bad', sig: [0, 0, 0], cost: 1 },
  };

  // 3 nút theo vị trí đứng
  BL.ZONES = {
    front: { name: 'Trên lưới', shots: ['net', 'crossnet', 'lift'] },
    mid: { name: 'Giữa sân', shots: ['drive', 'block', 'jsmash'] },
    back: { name: 'Cuối sân', shots: ['drop', 'clear', 'jsmash'] },
    serve: { name: 'Giao cầu', shots: ['serve_short', 'serve_high', 'serve_flick'] },
  };
  BL.zoneOf = (y) => {
    const a = Math.abs(y);
    return a < 2.3 ? 'front' : a < 4.5 ? 'mid' : 'back';
  };

  // Đổi cú đánh nếu độ cao điểm chạm không cho phép (vd đập khi cầu đã xuống thấp)
  BL.adaptShot = function (shot, z, ay, p) {
    const h = BL.netHeight(0);
    if (shot === 'jsmash' || shot === 'smash') {
      if (ay < 2.0 && z > h + 0.25) return 'kill';
      if (z >= 2.0) return z > p.d.reachUp - 0.05 ? 'jsmash' : 'smash';
      if (z >= 1.0) return 'drive';
      return 'block';
    }
    if (shot === 'net' || shot === 'crossnet') {
      if (ay < 2.0 && z > h + 0.35) return 'kill'; // cầu bổng trên lưới -> chụp
      return shot;
    }
    if (shot === 'clear' || shot === 'drop') {
      if (z < 0.9) return shot === 'clear' ? 'lift' : 'net';
      return shot;
    }
    if (shot === 'drive') {
      if (z < 0.45) return 'block';
      return shot;
    }
    return shot;
  };

  function solveNetLike(z0, d, rNet, hNet, minClear, sMax, overNet) {
    // tìm góc cho đỉnh cầu thấp nhất mà vẫn qua lưới với khoảng hở >= minClear
    let best = null, bestAny = null;
    const t0 = overNet ? -35 : 5;
    for (let deg = t0; deg <= 82; deg += 3) {
      const r = BL.solveSpeed(z0, deg * D2R, d, rNet, hNet, 0.5, sMax);
      if (r.short) continue;
      const cl = r.res.clear;
      if (!bestAny || cl > bestAny.res.clear) bestAny = r;
      if (cl >= minClear) {
        // ưu tiên: đỉnh thấp + bay nhanh (ít thời gian cho đối thủ)
        const score = r.res.apex + r.res.t * 0.35;
        if (!best || score < best.score) { best = r; best.score = score; }
      }
    }
    return best || bestAny;
  }

  // ctx: { opp:{x,y}, aimX: null|-1..1 (thế giới), pressure: 0..1, stretch: 0..1, jumped, rl (giao cầu) }
  BL.planShot = function (p, c, shot, ctx) {
    const d = p.d, s = p.side, o = -s;
    const W = C.HALF_W_S - d.sideMargin;
    const L = C.HALF_L - d.backMargin;
    const opp = ctx.opp || { x: 0, y: o * 3.5 };
    let aimX = ctx.aimX;
    const autoSide = () => {
      if (Math.abs(opp.x) > 0.25) return -Math.sign(opp.x);
      return BL.rand() < 0.5 ? -1 : 1;
    };
    if (aimX === null || aimX === undefined) aimX = autoSide() * (0.75 + BL.rand() * 0.25);
    // bị ép (với xa, cầu nhanh) thì đánh an toàn: vào giữa sân, không sát vạch
    const safety = BL.clamp((ctx.pressure || 0) + (ctx.stretch || 0) * 0.5, 0, 1);
    let tx = aimX * W * (1 - 0.45 * safety), depth, plan = null;
    const deepSafe = 0.7 * safety;
    const fat = 1 + Math.max(0, 1 - p.energy / 100) * 0.9;
    const z0 = c[2];

    const geo = (tx, depth) => {
      const ty = o * depth;
      const dx = tx - c[0], dy = ty - c[1];
      const dist = Math.hypot(dx, dy);
      const f = (0 - c[1]) / (ty - c[1]);
      const rNet = dist * f;
      const hNet = BL.netHeight(c[0] + dx * f);
      return { ty, dx, dy, dist, rNet, hNet, az: Math.atan2(dy, dx) };
    };

    let g;
    switch (shot) {
      case 'clear': {
        depth = L - deepSafe;
        g = geo(tx, depth);
        for (const deg of [38, 34, 30, 27]) {
          const r = BL.solveSpeed(z0, deg * D2R, g.dist, g.rNet, g.hNet, 5, d.clearMax);
          plan = r;
          if (!r.short && r.res.clear > 0.4) break;
        }
        break;
      }
      case 'lift': case 'block': {
        depth = L - (shot === 'block' ? 0.35 : 0.15) - deepSafe;
        tx *= 0.8;
        const vmax = d.clearMax * (shot === 'block' ? 0.82 : 0.9);
        g = geo(tx, depth);
        // hất/đỡ: góc dốc, đủ cao để đối thủ không chặn được giữa đường
        for (const deg of [64, 58, 52, 46, 40, 34]) {
          const r = BL.solveSpeed(z0, deg * D2R, g.dist, g.rNet, g.hNet, 3, vmax);
          const better = !plan || (plan.short && !r.short) || (plan.short === r.short && r.res.clear > plan.res.clear);
          if (better) plan = r;
          if (!r.short && r.res.clear > 0.5) { plan = r; break; }
        }
        break;
      }
      case 'serve_high': case 'serve_flick': {
        const sx = BL.courtXSign(o, ctx.rl);
        tx = sx * (1.0 + BL.rand() * 0.9) * 0.9;
        depth = C.HALF_L - 0.3 - d.backMargin * 0.5;
        g = geo(tx, depth);
        const degs = shot === 'serve_high' ? [62, 58, 54, 50] : [30, 27, 34, 38];
        for (const deg of degs) {
          const r = BL.solveSpeed(z0, deg * D2R, g.dist, g.rNet, g.hNet, 3, d.clearMax);
          plan = r;
          if (!r.short && r.res.clear > 0.5) break;
        }
        break;
      }
      case 'serve_short': {
        const sx = BL.courtXSign(o, ctx.rl);
        tx = sx * (0.25 + BL.rand() * 0.35);
        depth = C.SHORT_SVC + 0.14 + (d.acc - 0.6) * 0.22;
        g = geo(tx, depth);
        plan = solveNetLike(z0, g.dist, g.rNet, g.hNet, d.netClear + 0.04, 20, false);
        break;
      }
      case 'net': case 'crossnet': case 'defend': {
        if (shot === 'crossnet') tx = (Math.abs(c[0]) > 0.3 ? -Math.sign(c[0]) : -Math.sign(opp.x || 1)) * W * 0.95;
        else if (shot === 'net') tx = BL.clamp(c[0] * 0.9 + aimX * 0.3, -W, W);
        depth = shot === 'defend' ? 1.0 + BL.rand() * 1.2 : 0.35 + (d.netClear - 0.035) * 3 + BL.rand() * 0.3;
        g = geo(tx, depth);
        const over = z0 > g.hNet + 0.05;
        plan = solveNetLike(z0, g.dist, g.rNet, g.hNet, shot === 'defend' ? 0.18 : d.netClear + 0.02, 30, over);
        break;
      }
      case 'drop': {
        let spd = d.dropSpeed;
        depth = 1.1 + (d.acc - 0.6) * 0.6 + BL.rand() * 0.5;
        for (let k = 0; k < 6; k++) {
          g = geo(tx, depth);
          plan = BL.solveAngle(z0, spd, g.dist, g.rNet, g.hNet, -55 * D2R, 35 * D2R);
          if (plan.res.clear >= 0.12 && !plan.short) break;
          if (plan.short) spd *= 1.12; else { spd *= 0.9; depth += 0.25; }
        }
        break;
      }
      case 'drive': {
        // tạt: góc thấp nhất (nhanh nhất) mà vẫn qua lưới an toàn và rơi trong sân
        depth = 4.6 + BL.rand() * 1.4;
        g = geo(tx, depth);
        for (let deg = -10; deg <= 30; deg += 2) {
          const r = BL.solveSpeed(z0, deg * D2R, g.dist, g.rNet, g.hNet, 4, d.drive);
          if (r.short) continue;
          if (!plan || r.res.clear > plan.res.clear) plan = r;
          if (r.res.clear >= 0.12) { plan = r; break; }
        }
        if (!plan) plan = BL.solveSpeed(z0, 20 * D2R, g.dist, g.rNet, g.hNet, 4, d.drive);
        break;
      }
      case 'smash': case 'jsmash': case 'kill': {
        let spd = shot === 'kill' ? d.smash * 0.7 : d.smash + (shot === 'jsmash' ? d.jumpBonus : 0);
        spd *= 1 - Math.max(0, 1 - p.energy / 100) * 0.15;
        depth = shot === 'kill' ? 2.2 + BL.rand() * 1.2 : 3.0 + BL.rand() * 1.8;
        for (let k = 0; k < 10; k++) {
          g = geo(tx, depth);
          plan = BL.solveAngle(z0, spd, g.dist, g.rNet, g.hNet, -75 * D2R, 12 * D2R);
          if (plan.res.clear >= (shot === 'kill' ? 0.08 : 0.06 + Math.abs(c[1]) * 0.03) || depth > C.HALF_L - 0.4) break;
          depth += 0.45;
        }
        break;
      }
      case 'mishit': default: {
        // đánh hỏng: chạm khung vợt, cầu bay yếu và lạc hướng
        const roll = BL.rand();
        const az0 = Math.atan2(o, 0) + (BL.rand() - 0.5) * 0.9;
        let spd, th;
        if (roll < 0.45) { spd = 4 + BL.rand() * 5; th = (-5 + BL.rand() * 18) * D2R; }
        else if (roll < 0.8) { spd = 8 + BL.rand() * 8; th = (45 + BL.rand() * 25) * D2R; }
        else { spd = 14 + BL.rand() * 18; th = (5 + BL.rand() * 35) * D2R; }
        const az = roll >= 0.8 ? az0 + (BL.rand() < 0.5 ? -1 : 1) * (0.5 + BL.rand() * 0.5) : az0;
        return {
          shot: 'mishit', v: [spd * Math.cos(th) * Math.cos(az), spd * Math.cos(th) * Math.sin(az), spd * Math.sin(th)],
          speed: spd, target: null,
        };
      }
    }

    // Sai số: góc nâng, góc ngang, lực — nhân theo kỹ thuật, độ với, áp lực, mệt
    const sg = BL.SHOTS[shot].sig;
    const m = d.acc * (1 + 0.5 * (ctx.stretch || 0)) * (1 + 1.0 * (ctx.pressure || 0)) * fat;
    const th = plan.theta + BL.gauss() * sg[0] * D2R * m;
    const az = g.az + BL.gauss() * sg[1] * D2R * m;
    const spd = plan.speed * (1 + BL.gauss() * sg[2] * m);
    const v = [spd * Math.cos(th) * Math.cos(az), spd * Math.cos(th) * Math.sin(az), spd * Math.sin(th)];
    return { shot, v, speed: spd, target: [tx, g.ty], plan };
  };
})(typeof window !== 'undefined' ? window : globalThis);
