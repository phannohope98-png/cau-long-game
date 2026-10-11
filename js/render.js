// Vẽ: camera phối cảnh nhìn chéo từ trên xuống sau lưng người chơi, sân BWF, lưới, nhân vật, quả cầu, tua lại.
(function (G) {
  const BL = G.BL;
  const C = BL.C;
  const V = BL.v3;
  const R = (BL.Render = {});

  let cv, ctx, W = 0, H = 0, DPR = 1;
  const cam = { pos: [0, -13, 7], tgt: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1], f: [0, 1, 0], focal: 800, cx: 0, cy: 0 };
  const fx = { trail: [], pops: [], bursts: [], dust: [] };
  let camX = 0, camTY = 0, shake = 0;

  R.init = function (canvas) {
    cv = canvas;
    ctx = cv.getContext('2d');
    R.resize();
  };
  R.resize = function () {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fitMain();
  };

  function setCam(pos, tgt) {
    cam.pos = pos; cam.tgt = tgt;
    const f = V.norm(V.sub(tgt, pos));
    const r = V.norm(V.cross(f, [0, 0, 1]));
    cam.f = f; cam.r = r; cam.u = V.cross(r, f);
  }
  function proj(p) {
    const d = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
    let z = d[0] * cam.f[0] + d[1] * cam.f[1] + d[2] * cam.f[2];
    if (z < 0.05) z = 0.05;
    const x = d[0] * cam.r[0] + d[1] * cam.r[1] + d[2] * cam.r[2];
    const y = d[0] * cam.u[0] + d[1] * cam.u[1] + d[2] * cam.u[2];
    const s = cam.focal / z;
    return { x: cam.cx + x * s, y: cam.cy - y * s, s, z };
  }
  R.proj = proj;

  // Khung nhìn chính: cả nửa sân mình + một phần sân đối thủ
  const MAIN_POS = [0, -12.6, 7.0], MAIN_TGT = [0, -0.4, 0];
  function fitMain() {
    const n = fitFor(2.6, 1.8), d = fitFor(6.9, 2.9);
    cam.fitN = n; cam.fitD = d;
    cam.baseCx = n.cx; cam.baseCy = n.cy; cam.baseFocal = n.focal;
  }
  // khung vừa khít: cả nửa sân mình + sân đối thủ tới độ sâu farY (người đứng cao farZ)
  function fitFor(farY, farZ) {
    setCam(MAIN_POS, MAIN_TGT);
    cam.focal = 1; cam.cx = 0; cam.cy = 0;
    const pts = [[-3.4, -7.3, 0], [3.4, -7.3, 0], [-3.1, farY, 0], [3.1, farY, 0], [0, 0, 1.55], [0, farY + 0.6, farZ]];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const q = proj(p); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const portrait = H > W;
    const fw = (W * (portrait ? 1.12 : 0.98)) / (x1 - x0), fh = (H * (portrait ? 0.7 : 0.9)) / (y1 - y0);
    const focal = Math.min(fw, fh);
    return { focal, cx: W / 2 - ((x0 + x1) / 2) * focal, cy: (portrait ? H * 0.45 : H * 0.53) - ((y0 + y1) / 2) * focal };
  }

  // ---------- vẽ cơ bản ----------
  function poly(pts3, fill, stroke, lw) {
    ctx.beginPath();
    for (let i = 0; i < pts3.length; i++) { const q = proj(pts3[i]); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  const rect = (x0, y0, x1, y1, z, fill) => poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill);
  function ellipseG(x, y, rx, ry, fill, n = 18) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry, 0.002]); }
    poly(pts, fill);
  }

  // ---------- nhà thi đấu ----------
  function drawArena() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b1020'); g.addColorStop(0.5, '#141b30'); g.addColorStop(1, '#0e1322');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // khán đài phía xa
    const back = 11.5;
    poly([[-14, back, 0], [14, back, 0], [14, back + 4, 6], [-14, back + 4, 6]], '#1a2036');
    for (let row = 0; row < 7; row++) {
      const z = 1.2 + row * 0.7, y = back + row * 0.55;
      const a = proj([-12, y, z]), b = proj([12, y, z]);
      ctx.fillStyle = row % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(a.x, a.y - 3, b.x - a.x, 6);
      // khán giả: chấm màu
      const n = 40;
      for (let i = 0; i < n; i++) {
        const xx = -12 + (i + 0.5) * 24 / n + Math.sin(i * 7.3 + row) * 0.15;
        const q = proj([xx, y, z + 0.25]);
        const hue = (i * 47 + row * 31) % 360;
        ctx.fillStyle = `hsla(${hue},45%,${35 + (i * row) % 20}%,0.75)`;
        ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, q.s * 0.11), 0, 6.283); ctx.fill();
      }
    }
    // sàn nhà thi đấu
    poly([[-14, -16, 0], [14, -16, 0], [14, back, 0], [-14, back, 0]], '#27303f');
    // bảng quảng cáo
    const ads = ['CẦU LÔNG VIỆT', 'SMASH 400', 'LÔNG VŨ', 'VỢT XỊN', 'HAWK-EYE'];
    const adCols = ['#c62f3a', '#1f6fd1', '#e3a21a', '#18915b', '#7a3fc9'];
    for (let i = 0; i < 5; i++) {
      const x0 = -10 + i * 4, x1 = x0 + 3.9, y = 9.2;
      poly([[x0, y, 0], [x1, y, 0], [x1, y, 0.8], [x0, y, 0.8]], adCols[i]);
      const q = proj([(x0 + x1) / 2, y, 0.4]);
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(6, q.s * 0.36)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ads[i], q.x, q.y);
    }
    // thảm sân
    rect(-C.HALF_W_D - 1.4, -C.HALF_L - 2.0, C.HALF_W_D + 1.4, C.HALF_L + 2.0, 0, '#16674a');
    rect(-C.HALF_W_D, -C.HALF_L, C.HALF_W_D, C.HALF_L, 0.001, '#1b7a56');
    // ánh đèn
    const q = proj([0, -2, 0]);
    const rg = ctx.createRadialGradient(q.x, q.y, 10, q.x, q.y, W * 0.7);
    rg.addColorStop(0, 'rgba(255,255,230,0.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  }

  function drawLines() {
    const lw = C.LINE_W, z = 0.003, col = '#f4f7f2';
    const L = C.HALF_L, Wd = C.HALF_W_D, Ws = C.HALF_W_S;
    // biên dọc đôi & đơn
    for (const s of [-1, 1]) {
      rect(s * Wd - s * lw, -L, s * Wd, L, z, col);
      rect(s * Ws - s * lw, -L, s * Ws, L, z, col);
    }
    for (const s of [-1, 1]) {
      rect(-Wd, s * L - s * lw, Wd, s * L, z, col); // biên cuối
      rect(-Wd, s * (L - C.LONG_SVC_D), Wd, s * (L - C.LONG_SVC_D) + s * lw, z, col); // vạch giao cầu xa (đôi)
      rect(-Wd, s * C.SHORT_SVC, Wd, s * (C.SHORT_SVC + lw), z, col); // vạch giao cầu gần
      rect(-lw / 2, s * C.SHORT_SVC, lw / 2, s * L, z, col); // vạch giữa
    }
  }

  function drawNet() {
    const Wd = C.HALF_W_D;
    // lưới
    const top = [], bot = [];
    for (let i = 0; i <= 20; i++) { const x = -Wd + (i / 20) * 2 * Wd; top.push([x, 0, BL.netHeight(x)]); bot.push([x, 0, 0.76]); }
    poly(top.concat(bot.slice().reverse()), 'rgba(20,24,30,0.38)');
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let x = -Wd; x <= Wd + 1e-6; x += 0.12) {
      const a = proj([x, 0, BL.netHeight(x)]), b = proj([x, 0, 0.76]);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let zz = 0.8; zz < 1.52; zz += 0.08) {
      const a = proj([-Wd, 0, Math.min(zz, BL.netHeight(-Wd))]), b = proj([Wd, 0, Math.min(zz, BL.netHeight(Wd))]);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    // băng trắng mép lưới (75 mm gập đôi)
    const tape = [];
    for (let i = 0; i <= 20; i++) { const x = -Wd + (i / 20) * 2 * Wd; tape.push([x, 0, BL.netHeight(x) + 0.005]); }
    const tapeB = tape.map((p) => [p[0], 0, p[2] - 0.075]);
    poly(tape.concat(tapeB.reverse()), '#f2f2ee');
    // cột lưới
    for (const s of [-1, 1]) {
      const a = proj([s * Wd, 0, 0]), b = proj([s * Wd, 0, C.NET_H_P + 0.02]);
      ctx.strokeStyle = '#0d0f14'; ctx.lineWidth = Math.max(2, a.s * 0.05); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.strokeStyle = '#c7ccd6'; ctx.lineWidth = Math.max(1, a.s * 0.025);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // ---------- nhân vật ----------
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(BL.clamp(r * k, 0, 255)); g = Math.round(BL.clamp(g * k, 0, 255)); b = Math.round(BL.clamp(b * k, 0, 255));
    return `rgb(${r},${g},${b})`;
  }
  function seg(a, b, rad, col, out) {
    const pa = proj(a), pb = proj(b);
    const w = Math.max(1.2, rad * 2 * (pa.s + pb.s) / 2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = out; ctx.lineWidth = w + 2.2;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  function hl(a, b, rad, col) {
    // vệt sáng tạo khối
    const pa = proj(a), pb = proj(b);
    const w = Math.max(0.6, rad * 0.7 * (pa.s + pb.s) / 2);
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pa.x - w * 0.6, pa.y - w * 0.4); ctx.lineTo(pb.x - w * 0.6, pb.y - w * 0.4); ctx.stroke();
  }

  function drawPlayerShadow(s) {
    const k = 1 / (1 + (s.jumpZ || 0) * 2);
    ellipseG(s.x, s.y, 0.42 * k, 0.3 * k, `rgba(0,0,0,${0.32 * k})`);
  }

  function drawPlayer(s, shuttlePos) {
    if (s.holding && shuttlePos) s.heldPos = shuttlePos;
    const P = BL.Anim.pose(s);
    const lk = s.kit;
    const skin = lk.skin, shirt = lk.color, shorts = lk.shorts, hair = lk.hair;
    const OUT = 'rgba(10,12,18,0.85)';
    const sk2 = shade(skin, 0.82);
    const items = [];
    const add = (a, b, fn) => items.push({ z: (proj(a).z + proj(b).z) / 2, fn });
    const mix = (a, b, t) => V.lerp(a, b, t);
    // chân
    for (const side of ['L', 'R']) {
      const hip = side === 'L' ? P.hipL : P.hipR, kn = side === 'L' ? P.kneeL : P.kneeR, an = side === 'L' ? P.ankL : P.ankR, toe = side === 'L' ? P.toeL : P.toeR;
      const far = side === 'L' ? 0.88 : 1;
      add(hip, an, () => {
        const midT = mix(hip, kn, 0.45);
        seg(midT, kn, 0.062, shade(skin, far), OUT);
        seg(kn, an, 0.052, shade(skin, far * 0.95), OUT);
        seg(mix(kn, an, 0.72), an, 0.056, '#f3f3f3', OUT); // tất
        seg(an, toe, 0.05, '#fafafa', OUT); // giày
        seg(mix(an, toe, 0.2), toe, 0.03, shade(shirt, 0.9), 'rgba(0,0,0,0)');
        seg(hip, midT, 0.088, shade(shorts, far), OUT); // quần
      });
    }
    // thân
    add(P.pelvis, P.chest, () => {
      // khối thân (độ dày) + mặt thân hình chữ V: vai rộng, eo thon
      seg(P.pelvis, P.chest, 0.12, shade(shirt, 0.8), OUT);
      const wsR = V.lerp(P.hipR, P.pelvis, 0.05), wsL = V.lerp(P.hipL, P.pelvis, 0.05);
      const up = V.lerp(P.chest, P.pelvis, -0.05);
      const shR2 = V.add(P.rSh, V.mul(V.norm(V.sub(P.rSh, P.chest)), 0.04)), shL2 = V.add(P.lSh, V.mul(V.norm(V.sub(P.lSh, P.chest)), 0.04));
      ctx.beginPath();
      [shL2, up, shR2, V.lerp(shR2, wsR, 0.55), wsR, wsL, V.lerp(shL2, wsL, 0.55)].forEach((p, i) => { const q = proj(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
      ctx.closePath(); ctx.fillStyle = shirt; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
      seg(P.lSh, P.rSh, 0.055, shirt, 'rgba(0,0,0,0)');
      seg(P.hipL, P.hipR, 0.1, shorts, OUT);
      hl(P.pelvis, P.chest, 0.15, 'rgba(255,255,255,0.18)');
      // số áo/viền
      const c = proj(V.lerp(P.pelvis, P.chest, 0.55));
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(1, c.s * 0.028), 0, 6.283); ctx.fill();
    });
    // tay trái
    add(P.lSh, P.lHand, () => {
      seg(P.lSh, mix(P.lSh, P.lElb, 0.45), 0.05, shade(shirt, 0.88), OUT);
      seg(mix(P.lSh, P.lElb, 0.4), P.lElb, 0.042, sk2, OUT);
      seg(P.lElb, P.lHand, 0.036, sk2, OUT);
      seg(P.lHand, P.lHand, 0.04, sk2, OUT);
    });
    // tay phải + vợt
    add(P.rSh, P.racket.head, () => {
      seg(P.rSh, mix(P.rSh, P.rElb, 0.45), 0.05, shirt, OUT);
      seg(mix(P.rSh, P.rElb, 0.4), P.rElb, 0.043, skin, OUT);
      seg(P.rElb, P.rHand, 0.037, skin, OUT);
      drawRacket(P.racket, shirt);
      seg(P.rHand, P.rHand, 0.042, skin, OUT);
    });
    // đầu
    add(P.neck, P.head, () => {
      seg(P.neck, P.head, 0.045, sk2, OUT);
      const h = proj(P.head);
      const r = 0.105 * h.s;
      const towardCam = (P.F[0] * cam.f[0] + P.F[1] * cam.f[1]) < 0;
      const hb = proj(V.add(P.head, [-P.F[0] * 0.025, -P.F[1] * 0.025, 0.02]));
      const fc = proj(V.add(P.head, [P.F[0] * 0.03, P.F[1] * 0.03, -0.01]));
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      const drawHair = () => { ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(hb.x, hb.y, r * 1.02, 0, 6.283); ctx.fill(); ctx.stroke(); };
      const drawFace = () => {
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(fc.x, fc.y + r * 0.08, r * 0.9, 0, 6.283); ctx.fill();
        // mắt nhìn theo hướng mặt
        ctx.fillStyle = '#1a1a1a';
        const ex = P.R[0] * 0.035, ey = P.R[1] * 0.035;
        for (const s2 of [-1, 1]) {
          const e = proj(V.add(P.head, [P.F[0] * 0.095 + ex * s2, P.F[1] * 0.095 + ey * s2, 0.005]));
          ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(0.8, r * 0.09), 0, 6.283); ctx.fill();
        }
        // băng đô
        ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(1, r * 0.22);
        ctx.beginPath(); ctx.arc(hb.x, hb.y, r * 0.93, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      };
      if (towardCam) { drawHair(); drawFace(); }
      else {
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(fc.x, fc.y + r * 0.1, r * 0.92, 0, 6.283); ctx.fill(); ctx.stroke();
        drawHair();
        ctx.strokeStyle = shirt; ctx.lineWidth = Math.max(1, r * 0.22);
        ctx.beginPath(); ctx.arc(hb.x, hb.y + r * 0.05, r * 0.98, Math.PI * 0.05, Math.PI * 0.95, true); ctx.stroke();
      }
    });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.fn();
  }

  function drawRacket(rk, col) {
    // cán + thân vợt
    const shaftEnd = V.add(rk.hand, V.mul(rk.dir, 0.4));
    seg(rk.grip, rk.hand, 0.017, '#222', 'rgba(0,0,0,0.6)');
    const a = proj(rk.hand), b = proj(shaftEnd);
    ctx.strokeStyle = '#d8dbe2'; ctx.lineWidth = Math.max(1, a.s * 0.009); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // khung vợt (oval 23x20cm)
    const pts = [];
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      pts.push(V.add(rk.head, V.add(V.mul(rk.dir, Math.cos(t) * 0.12), V.mul(rk.across, Math.sin(t) * 0.1))));
    }
    ctx.beginPath();
    pts.forEach((p, i) => { const q = proj(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath();
    ctx.fillStyle = 'rgba(235,240,245,0.22)'; ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1.6, a.s * 0.016); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, a.s * 0.009); ctx.stroke();
    // dây đan
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      const p1 = proj(V.add(rk.head, V.add(V.mul(rk.dir, -0.11), V.mul(rk.across, k * 0.035))));
      const p2 = proj(V.add(rk.head, V.add(V.mul(rk.dir, 0.11), V.mul(rk.across, k * 0.035))));
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      const p3 = proj(V.add(rk.head, V.add(V.mul(rk.dir, k * 0.04), V.mul(rk.across, -0.09))));
      const p4 = proj(V.add(rk.head, V.add(V.mul(rk.dir, k * 0.04), V.mul(rk.across, 0.09))));
      ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
    }
    ctx.stroke();
  }

  // ---------- quả cầu ----------
  function drawShuttle(p, dir, big) {
    const k = big || 2.1; // phóng to cho dễ nhìn trên điện thoại (tua lại dùng cỡ thật)
    let d = V.len(dir) > 1e-5 ? V.norm(dir) : [0, 0, -1];
    const cork = p;
    const baseC = V.sub(p, V.mul(d, 0.075 * k));
    let a = V.cross(d, [0, 0, 1]); if (V.len(a) < 0.1) a = V.cross(d, [1, 0, 0]);
    a = V.norm(a); const b = V.norm(V.cross(d, a));
    const rim = [];
    for (let i = 0; i < 14; i++) { const t = (i / 14) * Math.PI * 2; rim.push(V.add(baseC, V.add(V.mul(a, Math.cos(t) * 0.034 * k), V.mul(b, Math.sin(t) * 0.034 * k)))); }
    const neck = V.sub(p, V.mul(d, 0.02 * k));
    const pc = proj(cork);
    if (!big) { // quầng sáng nhẹ giúp mắt bắt cầu nhanh
      const g = ctx.createRadialGradient(pc.x, pc.y, 0, pc.x, pc.y, Math.max(8, pc.s * 0.16));
      g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pc.x, pc.y, Math.max(8, pc.s * 0.16), 0, 6.283); ctx.fill();
    }
    // váy lông
    ctx.fillStyle = 'rgba(250,250,248,0.92)';
    ctx.strokeStyle = 'rgba(90,90,90,0.8)'; ctx.lineWidth = 0.8;
    const pn = proj(neck);
    for (let i = 0; i < 14; i++) {
      const q1 = proj(rim[i]), q2 = proj(rim[(i + 1) % 14]);
      ctx.beginPath(); ctx.moveTo(pn.x, pn.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath();
    rim.forEach((r, i) => { const q = proj(r); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
    ctx.closePath(); ctx.stroke();
    // đế cầu
    ctx.fillStyle = '#f5ecd8';
    ctx.beginPath(); ctx.arc(pc.x, pc.y, Math.max(1.8, 0.016 * k * pc.s), 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#7a6a50'; ctx.lineWidth = 0.8; ctx.stroke();
  }

  // ---------- hiệu ứng ----------
  R.effect = function (e) {
    if (e.type === 'hit') {
      fx.bursts.push({ p: [e.x, e.y, e.z], t: 0, big: e.shot === 'jsmash' || e.shot === 'smash' || e.shot === 'kill' });
      if (e.kmh > 160 && (e.shot === 'jsmash' || e.shot === 'smash' || e.shot === 'kill')) {
        fx.pops.push({ p: [e.x, e.y, e.z + 0.4], t: 0, text: Math.round(e.kmh) + ' km/h', col: '#ffd34d' });
        shake = Math.min(8, e.kmh / 50);
      }
      fx.trail.length = 0;
    } else if (e.type === 'land') {
      fx.dust.push({ p: [e.x, e.y, 0], t: 0 });
    }
  };

  function drawFx(dt) {
    for (let i = fx.bursts.length - 1; i >= 0; i--) {
      const b = fx.bursts[i]; b.t += dt;
      if (b.t > 0.35) { fx.bursts.splice(i, 1); continue; }
      const q = proj(b.p), k = b.t / 0.35;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = b.big ? 3 : 2;
      ctx.beginPath(); ctx.arc(q.x, q.y, (b.big ? 0.5 : 0.3) * q.s * (0.3 + k), 0, 6.283); ctx.stroke();
      if (b.big) {
        for (let j = 0; j < 8; j++) {
          const a = j * 0.785 + 0.3;
          const r1 = 0.2 * q.s * (0.5 + k), r2 = 0.55 * q.s * (0.5 + k);
          ctx.beginPath(); ctx.moveTo(q.x + Math.cos(a) * r1, q.y + Math.sin(a) * r1); ctx.lineTo(q.x + Math.cos(a) * r2, q.y + Math.sin(a) * r2); ctx.stroke();
        }
      }
    }
    for (let i = fx.dust.length - 1; i >= 0; i--) {
      const b = fx.dust[i]; b.t += dt;
      if (b.t > 0.6) { fx.dust.splice(i, 1); continue; }
      const k = b.t / 0.6;
      ellipseG(b.p[0], b.p[1], 0.05 + k * 0.25, 0.05 + k * 0.25, `rgba(255,255,255,${0.4 * (1 - k)})`);
    }
    for (let i = fx.pops.length - 1; i >= 0; i--) {
      const b = fx.pops[i]; b.t += dt;
      if (b.t > 1.3) { fx.pops.splice(i, 1); continue; }
      const q = proj([b.p[0], b.p[1], b.p[2] + b.t * 0.6]);
      ctx.globalAlpha = Math.min(1, (1.3 - b.t) * 2);
      ctx.font = `900 ${Math.max(14, Math.min(34, q.s * 0.32))}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(b.text, q.x, q.y); ctx.fillStyle = b.col; ctx.fillText(b.text, q.x, q.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawTrail(spd) {
    if (fx.trail.length < 2) return;
    const fast = spd > 16;
    for (let i = 1; i < fx.trail.length; i++) {
      const a = proj(fx.trail[i - 1]), b = proj(fx.trail[i]);
      const k = i / fx.trail.length;
      ctx.strokeStyle = fast ? `rgba(255,220,120,${0.55 * k})` : `rgba(255,255,255,${0.22 * k})`;
      ctx.lineWidth = Math.max(1, (fast ? 0.05 : 0.025) * a.s * k);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // vòng báo điểm rơi + vòng xanh khi đứng đúng chỗ đánh được
  function drawMarker(m, now) {
    const sh = m.shuttle, me = m.players[0];
    if (m.phase !== 'rally' || !sh.flight || sh.hitter === 0 || sh.flight.netHit) return;
    const since = m.t - sh.tHit;
    const showAt = me.d.reactTime * 1.3;
    if (since < showAt) return;
    const L = sh.flight.land;
    const a = Math.min(1, (since - showAt) / 0.2);
    // phản ứng thấp: vòng to và nhòe hơn
    const rr = 0.18 + (100 - me.stats.react) * 0.004;
    const pulse = 1 + Math.sin(now * 10) * 0.08;
    const pts = [];
    for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2; pts.push([L.x + Math.cos(t) * rr * pulse, L.y + Math.sin(t) * rr * pulse, 0.004]); }
    const ok = !!m.findContact(me, 3, true);
    poly(pts, ok ? `rgba(80,255,140,${0.18 * a})` : `rgba(255,214,60,${0.16 * a})`, ok ? `rgba(80,255,140,${0.95 * a})` : `rgba(255,214,60,${0.95 * a})`, 2.5);
    const c = proj([L.x, L.y, 0]);
    ctx.fillStyle = ok ? `rgba(80,255,140,${a})` : `rgba(255,214,60,${a})`;
    ctx.beginPath(); ctx.arc(c.x, c.y, 2.5, 0, 6.283); ctx.fill();
  }

  function shuttleDir(m) {
    const sh = m.shuttle, f = sh.flight;
    if (!f || !sh.inPlay) return [0, 0, -1];
    const k = sh.pi, k0 = Math.max(0, k - 2), k1 = Math.min(f.n - 1, k + 1);
    const d = [f.pts[k1 * 4] - f.pts[k0 * 4], f.pts[k1 * 4 + 1] - f.pts[k0 * 4 + 1], f.pts[k1 * 4 + 2] - f.pts[k0 * 4 + 2]];
    return V.len(d) > 1e-6 ? d : [0, 0, -1];
  }

  // ---------- khung hình chính ----------
  let lastNow = 0;
  R.draw = function (m, now) {
    const dt = lastNow ? Math.min(0.05, now - lastNow) : 0.016;
    lastNow = now;
    if (m.phase === 'replay' && m.replay) return drawReplay(m, dt);
    // camera theo nhẹ người chơi và cầu khi cầu bay sâu sang sân bên kia
    const me = m.players[0], op = m.players[1], sh = m.shuttle;
    camX += (BL.clamp(me.x * 0.35 + (sh.inPlay ? sh.x * 0.15 : 0), -1.1, 1.1) - camX) * Math.min(1, dt * 3);
    const deep = Math.max(sh.inPlay && sh.y > 0 ? sh.y : 0, op.y);
    camTY += (BL.clamp((deep - 3.2) / 2.6, 0, 1) - camTY) * Math.min(1, dt * 2.2);
    setCam([MAIN_POS[0] + camX, MAIN_POS[1], MAIN_POS[2]], [MAIN_TGT[0] + camX * 0.8, MAIN_TGT[1], MAIN_TGT[2]]);
    const k = BL.smooth(camTY), fN = cam.fitN, fD = cam.fitD;
    cam.focal = BL.lerp(fN.focal, fD.focal, k); cam.cx = BL.lerp(fN.cx, fD.cx, k); cam.cy = BL.lerp(fN.cy, fD.cy, k);
    if (shake > 0.05) { cam.cx += (Math.random() - 0.5) * shake; cam.cy += (Math.random() - 0.5) * shake; shake *= Math.pow(0.02, dt); }
    const snaps = m.players.map((p) => BL.snapPlayer(p, m));
    const sp = [sh.x, sh.y, sh.z];
    if (sh.inPlay) { fx.trail.push(sp.slice()); if (fx.trail.length > 14) fx.trail.shift(); }
    else fx.trail.length = 0;
    const spd = sh.flight && sh.inPlay ? sh.flight.pts[sh.pi * 4 + 3] : 0;
    drawScene(snaps, sp, shuttleDir(m), spd, m.phase === 'serve' && m.players[m.score.server].holding, () => drawMarker(m, now));
    drawFx(dt);
  };

  function drawScene(snaps, sp, sdir, spd, held, extraGround, shK) {
    drawArena();
    drawLines();
    if (extraGround) extraGround();
    // bóng
    for (const s of snaps) drawPlayerShadow(s);
    const sz = Math.max(0, sp[2]);
    const shR = 0.035 + sz * 0.01;
    ellipseG(sp[0], sp[1], shR, shR, `rgba(0,0,0,${BL.clamp(0.45 - sz * 0.06, 0.08, 0.45)})`, 10);
    // thứ tự vẽ: xa trước gần sau
    const list = [];
    snaps.forEach((s) => list.push({ z: proj([s.x, s.y, 0.9]).z, fn: () => drawPlayer(s, held ? sp : null) }));
    list.push({ z: proj([BL.clamp(sp[0], -3, 3), 0, 1.2]).z, fn: drawNet, net: true });
    list.push({ z: proj(sp).z - 0.02, fn: () => { if (!shK) drawTrail(spd); drawShuttle(sp, sdir, shK); } });
    list.sort((a, b) => b.z - a.z);
    for (const it of list) it.fn();
  }

  R._dbg = { setCam, cam, drawPlayer, drawArena, drawLines, drawNet, drawShuttle, get ctx() { return ctx; }, get W() { return W; }, get H() { return H; } };

  // ---------- tua lại Hawk-Eye ----------
  function drawReplay(m, dt) {
    const rp = m.replay, fr = rp.frames;
    if (!fr.length) return;
    const t = m.phaseT;
    const slow = rp.slow, intro = rp.intro;
    let idx = Math.floor(Math.max(0, t - intro) * 120 * slow);
    const done = idx >= fr.length - 1;
    idx = Math.min(fr.length - 1, idx);
    const f = fr[idx];
    // camera thấp, gần điểm rơi, nhìn dọc theo vạch quyết định
    const Lx = rp.x, Ly = rp.y, line = rp.margin.idx;
    let pos, tgt = [Lx, Ly, 0.15];
    if (line === 0 || line === 3) pos = [Lx + Math.sign(Lx || 1) * 0.15, Ly - Math.sign(Ly) * 2.6, 1.3];
    else pos = [Lx + (Lx > 0 ? -1.6 : 1.6), Ly + Math.sign(Ly) * 1.2, 1.3];
    setCam(pos, tgt);
    cam.focal = Math.min(W, H) * 1.05; cam.cx = W / 2; cam.cy = H * 0.58;
    drawScene(f.p, f.s, f.d || [0, 0, -1], f.v || 0, false, () => {
      // vệt đường bay (kiểu Hawk-Eye)
      ctx.strokeStyle = 'rgba(255,220,90,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath();
      for (let i = Math.max(0, idx - 90); i <= idx; i++) { const q = proj(fr[i].s); i === Math.max(0, idx - 90) ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y); }
      ctx.stroke(); ctx.setLineDash([]);
      if (!done) return;
      // dấu cầu trên sàn
      const ok = rp.inside;
      ellipseG(Lx, Ly, 0.018, 0.018, ok ? 'rgba(80,255,140,0.95)' : 'rgba(255,70,70,0.95)', 14);
      ellipseG(Lx, Ly, 0.05, 0.05, ok ? 'rgba(80,255,140,0.25)' : 'rgba(255,70,70,0.25)', 14);
    }, done ? 1 : 1.2);
    // khung tua
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H * 0.09); ctx.fillRect(0, H * 0.91, W, H * 0.09);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(14, H * 0.04)}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('◉ TUA LẠI • MẮT DIỀU HÂU', 16, H * 0.045);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffd34d';
    ctx.fillText('x' + slow.toFixed(2) + ' chậm', W - 72, H * 0.045);
    if (done) {
      const ok = rp.inside;
      const mm = Math.abs(rp.margin.m * 1000);
      ctx.textAlign = 'center';
      ctx.font = `900 ${Math.max(36, H * 0.14)}px system-ui, sans-serif`;
      ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(ok ? 'TRONG' : 'NGOÀI', W / 2, H * 0.27);
      ctx.fillStyle = ok ? '#4dff8c' : '#ff4d4d';
      ctx.fillText(ok ? 'TRONG' : 'NGOÀI', W / 2, H * 0.27);
      ctx.font = `700 ${Math.max(14, H * 0.04)}px system-ui, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText(ok ? `Đế cầu chạm vạch — còn ${mm < 1 ? '< 1' : mm.toFixed(0)} mm tới mép ngoài ${rp.margin.line}` : `Ra ngoài ${rp.margin.line} ${mm < 1 ? '< 1' : mm.toFixed(0)} mm`, W / 2, H * 0.95);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
