// Bộ máy trận đấu: giao cầu, pha cầu, va chạm vợt-cầu, xác suất đỡ theo chênh lệch chỉ số, tính điểm, tua lại.
(function (G) {
  const BL = G.BL;
  const C = BL.C;
  const DT = C.DT;

  function Player(idx, side, cfg) {
    this.idx = idx;
    this.side = side;
    this.name = cfg.name;
    this.stats = Object.assign({}, cfg.stats);
    this.d = BL.derive(this.stats);
    this.ctrl = cfg.ctrl || 'bot';
    this.reachMul = this.ctrl === 'human' ? 1.12 : 1; // vùng chạm rộng hơn chút cho người chơi cảm ứng
    this.aggro = cfg.aggro !== undefined ? cfg.aggro : 0.5;
    this.look = { color: cfg.color || '#d33', hair: cfg.hair || '#1a120c', skin: cfg.skin || '#e0aa82', shorts: cfg.shorts || '#1b1d28' };
    this.x = 0; this.y = side * 3.5; this.vx = 0; this.vy = 0;
    this.face = side < 0 ? Math.PI / 2 : -Math.PI / 2; // hướng nhìn (rad), mặc định nhìn về lưới
    this.energy = 100;
    this.intent = null;
    this.swing = null;
    this.recover = 0;
    this.gait = 0;
    this.jumpZ = 0;
    this.lunge = 0;
    this.target = null;
    this.reactT = 0;
    this.leave = false;
    this.planK = -1;
    this.holding = false;
    this.input = { mx: 0, my: 0, aimX: null };
    this.st = { hits: 0, smash: 0, maxSmash: 0, winners: 0, errors: 0, defOk: 0, defFail: 0 };
  }
  Player.prototype.fatigue = function () {
    return 0.68 + 0.32 * Math.min(1, this.energy / 60);
  };

  function Match(opts) {
    this.opts = Object.assign({ format: 'one', lineCall: true, autoMove: false, autoHit: false, reflex: true, timeScale: 0.8 }, opts);
    this.players = [new Player(0, -1, opts.p0), new Player(1, 1, opts.p1)];
    if (opts.p0.aggro !== undefined) this.players[0].aggro = opts.p0.aggro;
    this.score = BL.newScore(this.opts.format);
    this.score.server = opts.firstServer !== undefined ? opts.firstServer : 0;
    this.shuttle = { x: 0, y: 0, z: 0, flight: null, pi: 0, hitter: -1, shot: null, serve: false, rl: 'R', tHit: 0, inPlay: false };
    this.events = [];
    this.hist = [];
    this.t = 0;
    this.acc = 0;
    this.rally = 0;
    this.longest = 0;
    this.phase = 'serve';
    this.phaseT = 0;
    this.lastPoint = null;
    this.replay = null;
    this.startPoint();
  }
  BL.Match = Match;

  // Hướng đánh từ cần điều khiển: chỉ tính khi đẩy ngang dứt khoát (tránh ngắm nhầm lúc đang chạy)
  BL.joyAim = function (x) {
    x = x || 0;
    const a = Math.abs(x);
    if (a < 0.55) return null;
    return Math.sign(x) * (0.6 + 0.4 * (a - 0.55) / 0.45);
  };

  // Tầm với ngang theo độ cao cầu: tầm thấp/ngang người có bước lao (lunge) xa nhất,
  // cầu sát sàn và cầu trên đầu với ngang được ít hơn
  BL.reachAt = function (d, z) {
    if (z < 0.25) return d.reach * 1.05;
    if (z < 1.7) return d.reach * 1.3;
    if (z < 2.2) return d.reach * 1.1;
    return d.reach * 0.85;
  };
  BL.Player = Player;

  Match.prototype.emit = function (e) {
    e.t = this.t;
    this.events.push(e);
    if (this.events.length > 200) this.events.shift();
  };

  Match.prototype.startPoint = function () {
    const sc = this.score;
    const srv = this.players[sc.server], rcv = this.players[1 - sc.server];
    const rl = BL.serveCourt(sc);
    this.shuttle.rl = rl;
    // Người giao đứng gần vạch giao cầu (đánh đơn hay đứng ~1 m sau vạch), người nhận lùi hơn
    srv.x = BL.courtXSign(srv.side, rl) * 0.45; srv.y = srv.side * (C.SHORT_SVC + 0.9);
    rcv.x = BL.courtXSign(rcv.side, rl) * 0.55; rcv.y = rcv.side * (C.SHORT_SVC + 1.35);
    for (const p of this.players) {
      p.vx = p.vy = 0; p.swing = null; p.intent = null; p.jumpZ = 0; p.lunge = 0; p.recover = 0;
      p.target = null; p.leave = false; p.holding = false; p.planK = -1;
      p.face = Math.atan2(-p.side, (0 - p.x) * 0.05);
    }
    srv.holding = true;
    this.shuttle.flight = null; this.shuttle.inPlay = false; this.shuttle.hitter = -1; this.shuttle.serve = true;
    this.placeHeld(srv);
    this.phase = 'serve';
    this.phaseT = 0;
    this.rally = 0;
    this.hist.length = 0;
    this.botServeDelay = 0.9 + BL.rand() * 0.8;
    this.emit({ type: 'servePos', server: sc.server, rl });
  };

  // cầu cầm ở tay trái trước người khi chuẩn bị giao
  Match.prototype.placeHeld = function (p) {
    const fx = Math.cos(p.face), fy = Math.sin(p.face);
    const rx = fy, ry = -fx; // vector phải
    this.shuttle.x = p.x + fx * 0.42 - rx * 0.05;
    this.shuttle.y = p.y + fy * 0.42 - ry * 0.05;
    this.shuttle.z = 0.95;
  };

  Match.prototype.opp = function (p) { return this.players[1 - p.idx]; };

  // ---- vòng lặp ----
  Match.prototype.update = function (realDt) {
    this.acc += Math.min(0.1, realDt) * this.opts.timeScale;
    let n = 0;
    while (this.acc >= DT && n < 200) {
      this.step();
      this.acc -= DT;
      n++;
    }
  };

  Match.prototype.step = function () {
    this.t += DT;
    this.phaseT += DT;
    const ph = this.phase;
    if (ph === 'serve') this.stepServe();
    else if (ph === 'rally') this.stepRally();
    else if (ph === 'dead') { if (this.phaseT > 1.6) this.award(); }
    else if (ph === 'replay') { if (this.phaseT > this.replay.dur) this.award(); }
    else if (ph === 'interval' || ph === 'gamebreak') { if (this.phaseT > (ph === 'interval' ? 3 : 4) || this.skipBreak) { this.skipBreak = false; this.startPoint(); } }
    for (const p of this.players) this.updatePlayer(p);
    if (ph === 'rally' || ph === 'dead') this.record();
  };

  Match.prototype.stepServe = function () {
    const srv = this.players[this.score.server];
    this.placeHeld(srv);
    for (const p of this.players) p.energy = Math.min(100, p.energy + p.d.regen * DT * 0.3);
    if (srv.swing) return;
    let shot = null;
    if (srv.ctrl === 'bot' || this.opts.autoHit && srv.ctrl === 'human' && this.phaseT > 2.5) {
      if (this.phaseT > this.botServeDelay) shot = BL.AI.chooseServe(srv);
    } else if (srv.intent && BL.SHOTS[srv.intent.shot].kind === 'serve') {
      shot = srv.intent.shot;
    }
    if (!shot) return;
    srv.intent = null;
    // Động tác giao cầu thấp tay: chạm cầu dưới 1.15 m, trước thân
    const fx = Math.cos(srv.face), fy = Math.sin(srv.face);
    const c = [srv.x + fx * 0.45 + fy * 0.12, srv.y + fy * 0.45 - fx * 0.12, shot === 'serve_short' ? 0.98 : 0.85];
    srv.swing = { shot, kind: 'serve', t: 0, tc: 0.42, dur: 0.75, c, cIdx: -1, hit: false, jumpH: 0, lungeAmt: 0, fh: shot !== 'serve_short', serve: true };
  };

  Match.prototype.executeServe = function (srv) {
    const sw = srv.swing;
    const plan = BL.planShot(srv, sw.c, sw.shot, { opp: this.opp(srv), aimX: null, rl: this.shuttle.rl, pressure: 0, stretch: 0 });
    srv.holding = false;
    this.launch(srv, sw.c, plan, true);
  };

  Match.prototype.launch = function (p, c, plan, isServe) {
    const sh = this.shuttle;
    sh.flight = BL.simulateFlight(c, plan.v, p.side);
    sh.pi = 0;
    sh.hitter = p.idx;
    sh.shot = plan.shot;
    sh.serve = !!isServe;
    sh.inPlay = true;
    sh.tHit = this.t;
    sh.x = c[0]; sh.y = c[1]; sh.z = c[2];
    this.phase = 'rally';
    this.phaseT = 0;
    this.rally++;
    p.st.hits++;
    const kmh = plan.speed * 3.6;
    if (BL.SHOTS[plan.shot].kind === 'smash') {
      p.st.smash++;
      p.st.maxSmash = Math.max(p.st.maxSmash, kmh);
    }
    p.energy = Math.max(0, p.energy - BL.SHOTS[plan.shot].cost * 1.4 * p.d.drain);
    const o = this.opp(p);
    o.reactT = o.d.reactTime + BL.rand() * 0.06 + (plan.shot === 'drop' || plan.shot === 'crossnet' ? 0.05 : 0);
    o.target = null; o.leave = false; o.planK = -1;
    p.target = null; p.leave = false;
    this.emit({ type: 'hit', who: p.idx, shot: plan.shot, kmh, serve: !!isServe, x: c[0], y: c[1], z: c[2], net: sh.flight.netHit, cord: sh.flight.netCord });
  };

  Match.prototype.stepRally = function () {
    const sh = this.shuttle, f = sh.flight;
    if (sh.pi < f.n - 1) sh.pi++;
    const k = sh.pi;
    sh.x = f.pts[k * 4]; sh.y = f.pts[k * 4 + 1]; sh.z = f.pts[k * 4 + 2];
    if (f.netCord && f.crossIdx >= 0 && k === f.crossIdx) this.emit({ type: 'netcord' });
    if (k >= f.n - 1) this.land();
  };

  // ---- chạm sàn: xác định ai thắng pha cầu ----
  Match.prototype.land = function () {
    const sh = this.shuttle, f = sh.flight;
    const hitter = this.players[sh.hitter], other = this.opp(hitter);
    const L = f.land;
    let winner, reason, margin = null;
    if (f.netHit) {
      winner = other.idx;
      reason = f.underNet ? 'Cầu lọt dưới lưới' : sh.serve ? 'Giao cầu vào lưới' : 'Cầu chạm lưới';
      hitter.st.errors++;
    } else if (L.y * hitter.side > 0) {
      winner = other.idx; reason = 'Cầu không qua lưới'; hitter.st.errors++;
    } else {
      const inside = sh.serve ? BL.inServiceBox(L.x, L.y, other.side, sh.rl) : BL.inSingles(L.x, L.y, other.side);
      margin = BL.lineMargin(L.x, L.y, other.side, sh.serve ? { rl: sh.rl } : null);
      if (inside) {
        winner = hitter.idx;
        reason = sh.serve ? 'Giao cầu ăn điểm' : other.lastWhiff ? 'Đánh hụt' : 'Cầu rơi trong sân';
        hitter.st.winners++;
      } else {
        winner = other.idx;
        reason = sh.serve ? 'Giao cầu hỏng (' + margin.line + ')' : 'Cầu ra ngoài (' + margin.line + ')';
        hitter.st.errors++;
      }
    }
    this.longest = Math.max(this.longest, this.rally);
    this.lastPoint = { winner, reason, x: L.x, y: L.y, margin, shot: sh.shot, rally: this.rally };
    this.emit({ type: 'land', x: L.x, y: L.y, winner, reason, margin: margin ? margin.m : null });
    const close = margin && Math.abs(margin.m) < 0.08 && !f.netHit;
    if (close && this.opts.lineCall) {
      this.phase = 'replay';
      this.phaseT = 0;
      // tua chậm ~1 giây cuối của pha cầu: 0.5 s mở đầu + phim chậm x0.25 + 2 s giữ kết luận
      const nF = Math.min(this.hist.length, 120), slow = 0.25;
      this.replay = { x: L.x, y: L.y, margin, frames: this.hist.slice(-nF), inside: margin.m >= 0, side: other.side, slow, intro: 0.5 };
      this.replay.play = nF / 120 / slow;
      this.replay.dur = this.replay.intro + this.replay.play + 2.0;
      this.emit({ type: 'replay', inside: margin.m >= 0, m: margin.m });
    } else {
      this.phase = 'dead';
      this.phaseT = 0;
    }
  };

  Match.prototype.award = function () {
    const lp = this.lastPoint;
    const ev = BL.addPoint(this.score, lp.winner);
    this.emit({ type: 'point', winner: lp.winner, reason: lp.reason, ev, pts: this.score.pts.slice(), games: this.score.games.slice() });
    this.replay = null;
    if (ev.matchOver) {
      this.phase = 'over';
      this.phaseT = 0;
      this.winner = ev.matchWinner;
      this.emit({ type: 'over', winner: ev.matchWinner });
      return;
    }
    if (ev.gameOver) { this.phase = 'gamebreak'; this.phaseT = 0; this.emit({ type: 'gameover', winner: ev.gameWinner }); return; }
    if (ev.interval) { this.phase = 'interval'; this.phaseT = 0; this.emit({ type: 'interval' }); return; }
    this.startPoint();
  };

  // ---- ghi lại để tua chậm ----
  Match.prototype.record = function () {
    if (Math.round(this.t / DT) % 2) return;
    const sh = this.shuttle;
    const fr = { s: [sh.x, sh.y, sh.z], v: 0, p: this.players.map(snapPlayer) };
    if (sh.flight) {
      const k = sh.pi, f = sh.flight, k0 = Math.max(0, k - 2);
      fr.d = [f.pts[k * 4] - f.pts[k0 * 4], f.pts[k * 4 + 1] - f.pts[k0 * 4 + 1], f.pts[k * 4 + 2] - f.pts[k0 * 4 + 2]];
      fr.v = f.pts[k * 4 + 3];
    }
    this.hist.push(fr);
    if (this.hist.length > 400) this.hist.shift();
  };

  // Trạng thái tối thiểu để vẽ một nhân vật (dùng chung cho chơi thật và tua lại)
  function snapPlayer(p) {
    const sw = p.swing;
    return {
      x: p.x, y: p.y, face: p.face, vx: p.vx, vy: p.vy, gait: p.gait, jumpZ: p.jumpZ, lunge: p.lunge,
      holding: p.holding, side: p.side, look: p.look, energy: p.energy,
      sw: sw ? { kind: sw.kind, t: sw.t, tc: sw.tc, dur: sw.dur, c: sw.c, fh: sw.fh, shot: sw.shot, hit: sw.hit } : null,
    };
  }
  BL.snapPlayer = snapPlayer;

  // ---- người chơi: di chuyển, vung vợt, chạm cầu ----
  Match.prototype.updatePlayer = function (p) {
    const m = this, sh = this.shuttle, o = this.opp(p);
    const d = p.d;
    const auto = p.ctrl === 'bot';
    let want = null; // vận tốc mong muốn

    if (this.phase === 'rally') {
      const incoming = sh.hitter !== p.idx && sh.flight;
      if (incoming) {
        if (p.reactT > 0) p.reactT -= DT;
        if ((auto || this.opts.autoMove) && p.reactT <= 0) {
          if (p.planK < 0 || (this.t * 10 | 0) !== p.lastPlanTick) {
            p.lastPlanTick = this.t * 10 | 0;
            if (p.planK < 0) p.leave = BL.AI.judgeOut(p, this);
            const it = BL.AI.intercept(p, this, 0);
            p.planK = it.k;
            p.target = p.leave ? BL.AI.base(p, this) : it;
          }
        }
        if (!p.swing && !p.leave) this.tryStartSwing(p);
      } else if (auto || this.opts.autoMove) {
        // vừa đánh xong: về vị trí chờ
        if (!p.swing || p.swing.t > p.swing.tc + 0.1) p.target = BL.AI.base(p, this);
      }
    } else if (this.phase === 'dead' || this.phase === 'replay') {
      p.target = null;
    }

    // vận tốc mong muốn
    const vmax = d.speed * p.fatigue() * (p.recover > 0 ? 0.45 : 1) * (p.swing && p.swing.t < p.swing.tc && p.swing.lungeAmt > 0.3 ? 1.15 : 1);
    if (this.phase === 'serve' || this.phase === 'interval' || this.phase === 'gamebreak' || this.phase === 'over') {
      want = [0, 0];
    } else if (p.ctrl === 'human' && !this.opts.autoMove) {
      const mx = p.input.mx, my = p.input.my;
      const l = Math.hypot(mx, my);
      want = l > 0.08 ? [mx / Math.max(1, l) * vmax, my / Math.max(1, l) * vmax] : [0, 0];
    } else if (p.target) {
      const dx = p.target.x - p.x, dy = p.target.y - p.y, dist = Math.hypot(dx, dy);
      const sp = Math.min(vmax, dist * 5);
      want = dist > 0.03 ? [dx / dist * sp, dy / dist * sp] : [0, 0];
    } else want = [0, 0];

    if (p.jumpZ > 0.02) want = [p.vx, p.vy]; // trên không giữ quán tính
    // gia tốc giới hạn
    const ax = want[0] - p.vx, ay = want[1] - p.vy, al = Math.hypot(ax, ay);
    const amax = d.accel * DT * (p.lunge > 0.5 ? 0.4 : 1);
    if (al > amax) { p.vx += ax / al * amax; p.vy += ay / al * amax; } else { p.vx = want[0]; p.vy = want[1]; }
    p.x += p.vx * DT; p.y += p.vy * DT;
    // không chạm lưới, không chạy ra quá xa
    const s = p.side;
    if (p.y * s < 0.38) { p.y = s * 0.38; p.vy = 0; }
    if (p.y * s > C.HALF_L + 1.6) { p.y = s * (C.HALF_L + 1.6); p.vy = 0; }
    p.x = BL.clamp(p.x, -C.HALF_W_D - 1.2, C.HALF_W_D + 1.2);

    const spd = Math.hypot(p.vx, p.vy);
    p.gait += spd * DT / 0.62 * Math.PI; // nửa chu kỳ mỗi bước ~0.62 m
    // thể lực
    if (this.phase === 'rally') p.energy -= (0.4 + (spd / d.speed) * (spd / d.speed) * 3.0) * d.drain * DT;
    p.energy += d.regen * DT * (this.phase === 'rally' ? 0.06 : 0.45);
    p.energy = BL.clamp(p.energy, 0, 100);
    if (p.recover > 0) p.recover -= DT;

    // hướng người: nhìn về phía lưới, xoay theo cầu
    let tx = (sh.inPlay ? sh.x : 0) - p.x, ty = -s * 2.2;
    if (p.swing && p.swing.c) { tx = (p.swing.c[0] - p.x) * 0.6; }
    const tf = Math.atan2(ty, tx * 0.45);
    let df = tf - p.face;
    while (df > Math.PI) df -= 2 * Math.PI;
    while (df < -Math.PI) df += 2 * Math.PI;
    p.face += df * Math.min(1, DT * 9);

    // vung vợt
    if (p.swing) this.stepSwing(p);
    else { p.jumpZ = Math.max(0, p.jumpZ - DT * 3); p.lunge = Math.max(0, p.lunge - DT * 2.5); }
    if (this.phase === 'serve' && p.holding) this.placeHeld(p);
  };

  // Tìm điểm chạm tốt nhất trong tầm với (đường bay đã biết trước): người chơi chờ cầu vào
  // đúng tầm thoải mái chứ không vươn ở mép tầm; cầu cao thì ưu tiên đánh sớm ở điểm cao.
  Match.prototype.findContact = function (p, maxT, allowJump) {
    const sh = this.shuttle, f = sh.flight, pts = f.pts, d = p.d, s = p.side;
    const top = d.reachUp + (allowJump ? d.jump : 0.05);
    const kEnd = Math.min(f.n - 1, sh.pi + Math.ceil(maxT / DT));
    let best = null, bestS = 1e9, k0 = -1;
    for (let k = sh.pi + 1; k <= kEnd; k++) {
      const x = pts[k * 4], y = pts[k * 4 + 1], z = pts[k * 4 + 2];
      if (y * s < 0.12 || z < 0.1 || z > top) { if (k0 >= 0 && z < 0.1) break; continue; }
      // thân có thể nhích thêm trong lúc vung
      const dt = (k - sh.pi) * DT;
      const ex = p.x + p.vx * Math.min(dt, 0.12), ey = p.y + p.vy * Math.min(dt, 0.12);
      const reach = BL.reachAt(d, z) * p.reachMul;
      const hd = Math.hypot(x - ex, y - ey);
      if (hd > reach) { if (k0 >= 0 && k - k0 > 6) break; continue; }
      if (k0 < 0) k0 = k;
      if ((k - k0) * DT > 0.3) break;
      const st = hd / reach;
      const sc = st * st + (z < 0.35 ? 0.45 : 0) - (z > 2.0 ? 0.45 * (Math.min(z, 3.3) - 2.0) : 0) + (k - k0) * DT * 0.4;
      if (sc < bestS) { bestS = sc; best = { k, x, y, z, v: pts[k * 4 + 3], dt }; }
    }
    return best;
  };

  const WINDUP = { smash: 0.3, clear: 0.28, drop: 0.28, lift: 0.22, net: 0.2, drive: 0.17, serve: 0.42, bad: 0.15 };

  Match.prototype.tryStartSwing = function (p) {
    const sh = this.shuttle;
    let intent = null;
    const auto = p.ctrl === 'bot' || this.opts.autoHit;
    if (p.ctrl === 'human' && p.intent && BL.SHOTS[p.intent.shot].kind !== 'serve') intent = p.intent;
    const jumpOk = auto || (intent && (intent.shot === 'jsmash'));
    const c = this.findContact(p, 0.32, jumpOk);
    if (!c) return;
    const o = this.opp(p);
    let shot, aimX = null, reflex = false;
    if (intent) { shot = intent.shot; aimX = intent.aimX; }
    else if (auto) {
      const ch = BL.AI.chooseShot(p, this, [c.x, c.y, c.z], o);
      shot = ch.shot; aimX = p.ctrl === 'bot' ? ch.aimX : null;
    } else if (this.opts.reflex && c.v > 12 && p.ctrl === 'human') {
      // phản xạ tự động khi bị đập/tạt nhanh mà chưa kịp bấm
      shot = 'defend'; reflex = true;
    } else return;
    shot = BL.adaptShot(shot, c.z, Math.abs(c.y), p);
    const kind = BL.SHOTS[shot].kind;
    const wind = WINDUP[kind] || 0.2;
    if (c.dt > wind) return; // chưa tới lúc vung
    const tc = Math.max(0.05, c.dt);
    // chạm cầu phía tay thuận hay trái tay
    const fx = Math.cos(p.face), fy = Math.sin(p.face);
    const lat = (c.x - p.x) * fy - (c.y - p.y) * fx; // >0: bên phải
    const hd = Math.hypot(c.x - p.x, c.y - p.y);
    const jumpH = BL.clamp(c.z - (p.d.reachUp - 0.08), 0, p.d.jump) + (shot === 'jsmash' ? 0.12 : 0);
    const lungeAmt = c.z < 1.3 ? BL.clamp((hd - 0.45) / Math.max(0.2, p.d.reach - 0.45), 0, 1) : 0;
    p.swing = {
      shot, kind, t: 0, tc, dur: tc + 0.32 + lungeAmt * 0.25, c: [c.x, c.y, c.z], cIdx: c.k, hit: false,
      jumpH: Math.min(jumpH, p.d.jump + 0.12), lungeAmt, fh: lat > -0.12, aimX, reflex, vin: c.v, hd,
      tAvail: (this.t - sh.tHit) + c.dt,
    };
    if (p.ctrl === 'human') p.intent = null;
  };

  // Xác suất chạm cầu thành công — dựa trên chênh lệch chỉ số và độ khó tình huống
  BL.contactOdds = function (p, ctx) {
    const d = p.d;
    const fast = ctx.vin > 11;
    let skill = fast ? d.defense : d.control;
    if (ctx.reflex) skill -= 8;
    else if (p.ctrl === 'human') skill += 6; // chủ động bấm đúng lúc
    const stretch = BL.clamp(ctx.hd / (d.reach * 1.3 * (p.reachMul || 1)), 0, 1.2);
    let diff = Math.max(0, ctx.vin - 8) * 2.7 + stretch * stretch * 24 + Math.max(0, 0.55 - ctx.tAvail) * 70;
    if (ctx.kind === 'smash' && stretch > 0.6) diff += 6;
    if (ctx.kind === 'net' && ctx.z < 0.35) diff += 8; // cầu sát sàn
    diff *= 1 + Math.max(0, 1 - p.energy / 100) * 0.6;
    const prob = BL.sigmoid((skill - diff + 16) / 7);
    return { prob, pressure: BL.clamp(diff / 75, 0, 0.9), stretch, skill, diff };
  };

  Match.prototype.stepSwing = function (p) {
    const sw = p.swing, sh = this.shuttle;
    sw.t += DT;
    // nhảy & lao người
    if (sw.jumpH > 0) {
      const u = (sw.t - sw.tc) / 0.3;
      p.jumpZ = Math.abs(u) < 1 ? sw.jumpH * (1 - u * u) : 0;
    }
    if (sw.lungeAmt > 0) {
      const a = sw.t < sw.tc ? BL.smooth(sw.t / sw.tc) : sw.t < sw.tc + 0.15 ? 1 : 1 - BL.smooth((sw.t - sw.tc - 0.15) / 0.35);
      p.lunge = sw.lungeAmt * a;
    } else p.lunge = Math.max(0, p.lunge - DT * 3);

    if (!sw.hit && sw.t >= sw.tc) {
      sw.hit = true;
      if (sw.serve) { this.executeServe(p); }
      else if (this.phase === 'rally' && sh.hitter !== p.idx && sh.pi <= sw.cIdx + 2) {
        // cầu phải đúng ở điểm đã tính (đường bay tất định)
        const f = sh.flight, k = Math.min(sw.cIdx, f.n - 1);
        const c = [f.pts[k * 4], f.pts[k * 4 + 1], f.pts[k * 4 + 2]];
        const hd = Math.hypot(c[0] - p.x, c[1] - p.y);
        if (hd <= BL.reachAt(p.d, c[2]) * p.reachMul + 0.18 && c[2] > 0.05) {
          sh.pi = k;
          const odds = BL.contactOdds(p, { vin: sw.vin, hd, tAvail: sw.tAvail, reflex: sw.reflex, kind: sw.kind, z: c[2] });
          let shot = sw.shot;
          const ok = BL.rand() < odds.prob;
          if (!ok) shot = 'mishit';
          if (sw.kind === 'net' || sw.reflex || sw.vin > 11) { if (ok) p.st.defOk++; else p.st.defFail++; }
          const o = this.opp(p);
          const aim = p.ctrl === 'human' && !this.opts.autoHit ? (BL.joyAim(p.input.aimX) !== null ? BL.joyAim(p.input.aimX) : sw.aimX) : sw.aimX;
          const plan = BL.planShot(p, c, shot, { opp: o, aimX: aim, pressure: odds.pressure, stretch: odds.stretch, jumped: p.jumpZ > 0.1 });
          p.lastWhiff = false; o.lastWhiff = false;
          this.launch(p, c, plan, false);
          this.emit({ type: 'contact', who: p.idx, prob: odds.prob, ok, shot: plan.shot, wanted: sw.shot, reflex: sw.reflex });
        } else {
          p.lastWhiff = true;
          this.emit({ type: 'whiff', who: p.idx });
        }
      }
    }
    if (sw.t >= sw.dur) {
      if (sw.jumpH > 0.15 || sw.lungeAmt > 0.5) p.recover = 0.3 - p.stats.flex * 0.002;
      p.swing = null;
      p.jumpZ = 0;
    }
  };

  // ---- điều khiển từ UI ----
  Match.prototype.press = function (pIdx, shot) {
    const p = this.players[pIdx];
    p.intent = { shot, aimX: BL.joyAim(p.input.aimX), t: this.t };
    // đang vung: cho đổi cú đánh trước lúc chạm nếu cùng tư thế
    if (p.swing && !p.swing.hit && !p.swing.serve && p.swing.t < p.swing.tc - 0.04) {
      const ns = BL.adaptShot(shot, p.swing.c[2], Math.abs(p.swing.c[1]), p);
      if (BL.SHOTS[ns].kind === p.swing.kind || (p.swing.reflex && BL.SHOTS[ns].kind !== 'smash')) { p.swing.shot = ns; p.swing.reflex = false; p.swing.kind = BL.SHOTS[ns].kind; }
      p.intent = null;
    }
  };

  // shot mà từng nút đang đại diện cho người chơi
  Match.prototype.buttons = function (pIdx) {
    const p = this.players[pIdx];
    if (this.phase === 'serve' && this.score.server === pIdx) return BL.ZONES.serve.shots;
    return BL.ZONES[BL.zoneOf(p.y)].shots;
  };
  Match.prototype.zone = function (pIdx) {
    const p = this.players[pIdx];
    if (this.phase === 'serve' && this.score.server === pIdx) return 'serve';
    return BL.zoneOf(p.y);
  };
})(typeof window !== 'undefined' ? window : globalThis);
