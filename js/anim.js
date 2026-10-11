// Khung xương nhân vật (tỉ lệ người thật ~1m75) và động tác đúng kỹ thuật cầu lông:
// tư thế chờ, bước đệm (split-step), chạy bước / bước đuổi ngang / lùi nghiêng người,
// đập-phông-ve trên đầu (nghiêng vai, tay trái chỉ cầu, khuỷu cao, vợt rơi sau lưng, đá chéo chân),
// tạt thuận/trái tay, hất & bỏ nhỏ lao người (gót chạm trước), giao cầu trái tay / thuận tay.
// Toạ độ địa phương: [phải, trước, cao] theo hướng nhìn của người (face).
(function (G) {
  const BL = G.BL;
  const V = BL.v3;
  const A = (BL.Anim = {});

  // Kích thước cơ thể (m). Khi nạp mô hình người thật, đo từ khung xương mô hình và ghi đè qua A.setBody().
  const B = { thigh: 0.45, shin: 0.45, uarm: 0.3, farm: 0.28, racketC: 0.52, ankle: 0.075, pelvis: 0.87, tor: 0.5, shw: 0.2, hipw: 0.1, neck: 0.06, head: 0.15 };
  let THIGH, SHIN, UARM, FARM, RACKET_C;
  A.setBody = function (o) {
    Object.assign(B, o || {});
    THIGH = B.thigh; SHIN = B.shin; UARM = B.uarm; FARM = B.farm; RACKET_C = B.racketC;
    A.dims = { THIGH, SHIN, UARM, FARM, RACKET_C };
  };
  A.body = B;
  A.setBody();

  // IK 2 khớp: gốc a, đích t, độ dài l1,l2, hướng khớp giữa (pole). Trả về [giữa, cuối]
  function ik(a, t, l1, l2, pole) {
    let d = V.sub(t, a);
    let dist = V.len(d);
    const maxL = l1 + l2 - 1e-3;
    if (dist > maxL) { d = V.mul(d, maxL / dist); dist = maxL; t = V.add(a, d); }
    if (dist < 0.05) dist = 0.05;
    const dir = V.mul(d, 1 / dist);
    const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let pp = V.sub(pole, V.mul(dir, V.dot(pole, dir)));
    const pl = V.len(pp);
    pp = pl > 1e-4 ? V.mul(pp, 1 / pl) : [0, 0, 1];
    const mid = V.add(a, V.add(V.mul(dir, x), V.mul(pp, h)));
    return [mid, t];
  }
  A.ik = ik;

  const lerp = BL.lerp, lerp3 = V.lerp;
  const nlerp = (a, b, t) => V.norm(V.lerp(a, b, t));
  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const ease = BL.smooth;
  const easeIn = (t) => t * t * t;
  const rot2 = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

  // ---- khung hình chính ----
  // h: tay cầm vợt, r: hướng cán vợt, y: xoay vai, hy: xoay hông, l: tay trái,
  // fl/fr: chân trái/phải [phải, trước], sq: hạ trọng tâm, ln: nghiêng thân, ep: hướng khuỷu
  // thế chờ đơn: chân rộng hơn vai, gối chùng, trọng tâm trên mũi chân, vợt giơ trước ngực-mặt
  const READY = { h: [0.3, 0.32, 1.3], r: [0.1, 0.3, 1], y: 0, hy: 0, l: [-0.3, 0.28, 1.15], fl: [-0.23, 0.02], fr: [0.25, -0.06], sq: 0.08, ln: 0.17 };
  const K = (o) => Object.assign({}, READY, o);
  const KF = {
    over: { // phông / đập / ve trên đầu thuận tay
      back: K({ h: [0.24, -0.16, 1.66], r: [0.12, -0.3, -1], y: -1.3, hy: -0.95, l: [-0.12, 0.5, 1.95], fl: [-0.18, 0.28], fr: [0.26, -0.36], sq: 0.05, ln: 0.02, ep: 'up' }),
      ct: K({ y: 0.25, hy: 0.0, l: [-0.28, 0.02, 1.08], fl: [-0.18, 0.18], fr: [0.22, -0.12], sq: 0.0, ln: 0.12 }),
      fol: K({ h: [-0.3, 0.32, 0.95], r: [-0.5, 0.45, -1], y: 0.85, hy: 0.45, l: [-0.32, -0.18, 1.0], fl: [-0.22, -0.08], fr: [0.18, 0.3], sq: 0.14, ln: 0.38 }),
    },
    kill: { // vồ lưới: cổ tay chụp gọn, vợt đưa cao trước mặt
      back: K({ h: [0.3, 0.32, 1.78], r: [0.05, 0.1, 1], y: -0.35, hy: -0.15, l: [-0.3, 0.35, 1.3], fl: [-0.2, -0.1], fr: [0.2, 0.25], sq: 0.04, ln: 0.15, ep: 'up' }),
      ct: K({ y: 0.15, hy: 0.05, l: [-0.32, 0.2, 1.15], fl: [-0.2, -0.12], fr: [0.18, 0.38], sq: 0.06, ln: 0.25 }),
      fol: K({ h: [0.12, 0.55, 1.25], r: [-0.1, 0.9, -0.45], y: 0.35, hy: 0.15, l: [-0.32, 0.1, 1.05], fl: [-0.2, -0.15], fr: [0.18, 0.42], sq: 0.12, ln: 0.35 }),
    },
    side: { // tạt thuận tay
      back: K({ h: [0.52, -0.22, 1.32], r: [0.45, -1, 0.3], y: -0.85, hy: -0.5, l: [-0.38, 0.3, 1.2], fl: [-0.24, 0.12], fr: [0.3, -0.05], sq: 0.1, ln: 0.12 }),
      ct: K({ y: 0.1, hy: -0.05, l: [-0.36, 0.15, 1.12], fl: [-0.24, 0.1], fr: [0.32, 0.05], sq: 0.1 }),
      fol: K({ h: [-0.18, 0.45, 1.25], r: [-1, 0.35, 0.2], y: 0.6, hy: 0.25, l: [-0.36, -0.1, 1.05], fl: [-0.24, 0.08], fr: [0.3, 0.1], sq: 0.1 }),
    },
    sideB: { // tạt trái tay: quay lưng nhẹ, khuỷu dẫn trước
      back: K({ h: [-0.32, 0.02, 1.38], r: [-0.6, -0.65, 0.35], y: 0.95, hy: 0.55, l: [-0.25, -0.2, 1.1], fl: [-0.18, -0.05], fr: [-0.08, 0.32], sq: 0.1, ln: 0.15, ep: 'front' }),
      ct: K({ y: 0.25, hy: 0.3, l: [-0.32, -0.25, 1.05], fl: [-0.2, -0.05], fr: [-0.05, 0.35], sq: 0.1, ep: 'front' }),
      fol: K({ h: [0.45, 0.35, 1.38], r: [1, 0.4, 0.3], y: -0.25, hy: 0.15, l: [-0.32, -0.2, 1.05], fl: [-0.2, -0.05], fr: [-0.02, 0.33], sq: 0.1 }),
    },
    under: { // hất / đỡ thấp thuận tay
      back: K({ h: [0.42, -0.02, 0.92], r: [0.32, -0.45, -1], y: -0.5, hy: -0.25, l: [-0.42, -0.1, 1.1], sq: 0.12, ln: 0.25 }),
      ct: K({ y: 0.0, hy: 0.0, l: [-0.45, -0.25, 1.05], sq: 0.12, ln: 0.25 }),
      fol: K({ h: [0.05, 0.48, 1.58], r: [-0.08, 0.5, 1], y: 0.35, hy: 0.15, l: [-0.45, -0.2, 1.05], sq: 0.1, ln: 0.2 }),
    },
    underB: { // hất / đỡ thấp trái tay
      back: K({ h: [-0.32, 0.1, 0.98], r: [-0.5, -0.3, -0.85], y: 0.75, hy: 0.4, l: [-0.3, -0.25, 1.05], sq: 0.12, ln: 0.25, ep: 'front' }),
      ct: K({ y: 0.35, hy: 0.25, l: [-0.32, -0.28, 1.05], sq: 0.12, ln: 0.25, ep: 'front' }),
      fol: K({ h: [-0.05, 0.5, 1.48], r: [0.2, 0.5, 1], y: 0.0, hy: 0.1, l: [-0.32, -0.25, 1.05], sq: 0.1, ln: 0.2 }),
    },
    net: { // bỏ nhỏ: mặt vợt mở, đưa nhẹ cổ tay
      back: K({ h: [0.26, 0.44, 1.02], r: [0.15, 0.85, 0.5], y: -0.12, hy: 0, l: [-0.45, -0.3, 1.05], sq: 0.1, ln: 0.3 }),
      ct: K({ y: -0.05, l: [-0.48, -0.35, 1.05], sq: 0.1, ln: 0.3 }),
      fol: K({ h: [0.2, 0.56, 1.13], r: [0.05, 0.9, 0.45], y: 0, l: [-0.48, -0.35, 1.05], sq: 0.1, ln: 0.28 }),
    },
    serveS: { // giao ngắn trái tay: chân phải trước, vợt trước thắt lưng
      back: K({ h: [-0.02, 0.27, 0.98], r: [-0.4, 0.15, -1], y: 0.15, hy: 0.1, l: [-0.04, 0.46, 1.0], fl: [-0.16, -0.18], fr: [0.12, 0.22], sq: 0.04, ln: 0.12 }),
      ct: K({ y: 0.1, hy: 0.1, l: [-0.1, 0.4, 0.98], fl: [-0.16, -0.18], fr: [0.12, 0.22], sq: 0.04, ln: 0.14 }),
      fol: K({ h: [0.02, 0.45, 1.1], r: [-0.25, 0.75, -0.4], y: 0.1, hy: 0.1, l: [-0.3, 0.15, 0.98], fl: [-0.16, -0.18], fr: [0.12, 0.22], sq: 0.04, ln: 0.14 }),
    },
    serveH: { // giao cao thuận tay: chân trái trước, vung từ dưới lên, dồn trọng lượng
      back: K({ h: [0.46, -0.36, 1.2], r: [0.3, -0.6, 0.7], y: -0.8, hy: -0.55, l: [-0.08, 0.45, 1.02], fl: [-0.12, 0.3], fr: [0.24, -0.28], sq: 0.06, ln: 0.08 }),
      ct: K({ y: -0.1, hy: -0.1, l: [-0.2, 0.25, 0.98], fl: [-0.12, 0.3], fr: [0.22, -0.2], sq: 0.05 }),
      fol: K({ h: [-0.16, 0.4, 1.68], r: [-0.3, 0.4, 1], y: 0.55, hy: 0.3, l: [-0.38, -0.05, 1.0], fl: [-0.12, 0.3], fr: [0.16, 0.05], sq: 0.04, ln: 0.15 }),
    },
  };
  A.KF = KF;
  const SERVE_READY = { serveS: K({ h: [0.02, 0.3, 0.99], r: [-0.4, 0.2, -1], y: 0.15, hy: 0.1, l: [-0.04, 0.46, 1.0], fl: [-0.16, -0.18], fr: [0.12, 0.22], sq: 0.04, ln: 0.12 }), serveH: KF.serveH.back };
  // thế thủ khi đối thủ chuẩn bị đập: hạ thấp, chân rộng, vợt trước bụng chếch trái tay
  const DEF = K({ h: [0.06, 0.4, 1.02], r: [-0.4, 0.62, 0.55], fl: [-0.28, 0.0], fr: [0.29, 0.0], sq: 0.17, ln: 0.26, l: [-0.32, 0.22, 1.02] });
  // thế trên lưới: chân phải trước, vợt giơ cao trước mặt chờ chặn/vồ
  const NETS = K({ h: [0.28, 0.4, 1.48], r: [0.05, 0.3, 1], fl: [-0.2, -0.12], fr: [0.22, 0.2], sq: 0.1, ln: 0.24, l: [-0.3, 0.25, 1.2] });
  const RECEIVE = K({ h: [0.32, 0.12, 1.5], r: [0.1, 0.15, 1], fl: [-0.18, 0.2], fr: [0.22, -0.25], sq: 0.12, ln: 0.2, l: [-0.3, 0.32, 1.25] });

  function swingSet(sw) {
    if (sw.kind === 'serve') return sw.shot === 'serve_short' || sw.shot === 'serve_wide' ? KF.serveS : KF.serveH;
    if (sw.shot === 'kill') return KF.kill;
    const z = sw.c ? sw.c[2] : 1;
    if ((sw.kind === 'net' || sw.shot === 'push') && z < 1.45) return KF.net;
    if (z >= 1.85) return sw.fh || z > 2.2 ? KF.over : KF.sideB;
    if (z >= 0.95) return sw.fh ? KF.side : KF.sideB;
    return sw.fh ? KF.under : KF.underB;
  }
  A.swingSet = swingSet;

  // nội suy giữa 2 khung hình chính
  function mix(a, b, k) {
    return {
      h: lerp3(a.h, b.h, k), r: nlerp(a.r, b.r, k), y: lerp(a.y, b.y, k), hy: lerp(a.hy, b.hy, k), l: lerp3(a.l, b.l, k),
      fl: lerp2(a.fl, b.fl, k), fr: lerp2(a.fr, b.fr, k), sq: lerp(a.sq, b.sq, k), ln: lerp(a.ln, b.ln, k), ep: k < 0.5 ? a.ep : b.ep,
    };
  }

  // Tính tư thế: trả về các khớp trong không gian thế giới + khung hướng cho hông/ngực/đầu/vợt
  A.pose = function (s) {
    const fx = Math.cos(s.face), fy = Math.sin(s.face);
    const F = [fx, fy, 0], R = [fy, -fx, 0], Z = [0, 0, 1];
    const base = [s.x, s.y, s.jumpZ || 0];
    const L2W = (l) => [base[0] + R[0] * l[0] + F[0] * l[1], base[1] + R[1] * l[0] + F[1] * l[1], base[2] + l[2]];
    const D2W = (l) => [R[0] * l[0] + F[0] * l[1], R[1] * l[0] + F[1] * l[1], l[2]];
    const W2L = (w) => { const d = [w[0] - base[0], w[1] - base[1], w[2] - base[2]]; return [d[0] * R[0] + d[1] * R[1], d[0] * F[0] + d[1] * F[1], d[2]]; };
    const sw = s.sw;
    const cl = sw && sw.c ? W2L(sw.c) : null;

    // ---- chuyển động chân ----
    const spd = Math.hypot(s.vx, s.vy);
    const mvR = spd > 0.05 ? (s.vx * R[0] + s.vy * R[1]) / spd : 0;
    const mvF = spd > 0.05 ? (s.vx * F[0] + s.vy * F[1]) / spd : 0;
    const run = BL.clamp(spd / 2.2, 0, 1);
    const ph = s.gait;
    const lunge = s.lunge || 0;

    // ---- khung hình động tác ----
    let set = null, seg = 'ready', k = 0;
    let rest = s.holding ? (SERVE_READY[s.serveKind === 'serve_short' || s.serveKind === 'serve_wide' ? 'serveS' : 'serveH']) : s.receiving ? RECEIVE : READY;
    if (rest === READY && (s.stDef > 0.01 || s.stNet > 0.01)) {
      rest = mix(READY, DEF, s.stDef || 0);
      if (s.stNet > 0.01) rest = mix(rest, NETS, s.stNet);
    }
    let P = rest;
    if (sw) {
      set = swingSet(sw);
      const pr = sw.kind === 'serve' ? (set === KF.serveS ? SERVE_READY.serveS : set.back) : READY;
      if (sw.t < sw.tc) {
        const u = sw.t / sw.tc;
        if (u < 0.62) { seg = 'wind'; k = ease(u / 0.62); P = mix(pr, set.back, k); }
        else { seg = 'accel'; k = easeIn((u - 0.62) / 0.38); P = mix(set.back, set.ct, k); }
      } else {
        const v = (sw.t - sw.tc) / Math.max(0.05, sw.dur - sw.tc);
        if (v < 0.5) { seg = 'fol'; k = ease(v / 0.5); P = mix(set.ct, set.fol, k); }
        else { seg = 'rec'; k = ease((v - 0.5) / 0.5); P = mix(set.fol, READY, k); }
      }
    }
    // lùi về sau không đánh: xoay nghiêng người kiểu bước đuổi (chasse) như VĐV thật
    let hy = P.hy, yaw = P.y;
    if (!sw && spd > 1 && mvF < -0.35) { const b = Math.min(1, (-mvF - 0.35) * 2) * run; hy = lerp(hy, -0.95, b); yaw = lerp(yaw, -1.1, b); }

    // ---- bàn chân: khung hình (đứng) trộn với bước chạy ----
    let fl = P.fl.slice(), fr = P.fr.slice();
    let flz = 0, frz = 0;
    if (spd > 0.15 && lunge < 0.3) {
      const lateral = Math.abs(mvR) > 0.75 && !sw;
      const amp = BL.clamp(spd * 0.14, 0, 0.45);
      if (lateral) {
        // bước đuổi ngang: hai chân không bắt chéo, chân dẫn rồi chân theo
        const lead = mvR > 0 ? 1 : -1;
        const a1 = Math.sin(ph), a2 = Math.sin(ph - 1.2);
        fl = [fl[0] + lead * amp * 0.55 * (lead > 0 ? a2 : a1), fl[1]];
        fr = [fr[0] + lead * amp * 0.55 * (lead > 0 ? a1 : a2), fr[1]];
        flz = Math.max(0, Math.cos(ph - 1.2)) * 0.07 * run; frz = Math.max(0, Math.cos(ph)) * 0.07 * run;
      } else {
        const mv = [mvR, mvF];
        const la = Math.sin(ph) * amp, ra = -Math.sin(ph) * amp;
        const wb = sw ? 0.5 : 1;
        fl = [fl[0] + mv[0] * la * wb, fl[1] + mv[1] * la * wb];
        fr = [fr[0] + mv[0] * ra * wb, fr[1] + mv[1] * ra * wb];
        flz = Math.max(0, Math.cos(ph)) * 0.15 * run; frz = Math.max(0, -Math.cos(ph)) * 0.15 * run;
      }
    }
    // bước đệm (split-step): bật nhẹ, chân mở rộng, đúng lúc đối thủ chạm cầu
    const spl = s.split !== undefined && s.split < 1 ? Math.sin(Math.PI * s.split) : 0;
    if (spl > 0) { fl[0] -= 0.07 * spl; fr[0] += 0.07 * spl; }

    // hướng lao người
    let ux = 0, uy = 1;
    if (cl) { const dl = Math.hypot(cl[0], cl[1]); if (dl > 0.05) { ux = cl[0] / dl; uy = cl[1] / dl; } }
    if (lunge > 0.01 && cl) {
      // chân phải bước dài, gót chạm trước, gối thẳng trên cổ chân; chân trái duỗi sau
      const step = 1.05 * lunge;
      fr = lerp2(fr, [ux * step + 0.1 * uy, uy * step - 0.1 * ux], Math.min(1, lunge * 1.3));
      fl = lerp2(fl, [-ux * 0.42 - 0.13 * uy, -uy * 0.42 + 0.13 * ux], lunge * 0.9);
      frz = 0; flz = 0;
    }
    let pelvisH = B.pelvis - P.sq - lunge * 0.32 - spl * 0.05 - Math.abs(Math.cos(ph)) * 0.03 * run;
    // trên không: đá chéo chân (scissor kick) khi nhảy đập
    const air = s.jumpZ > 0.02 ? Math.min(1, s.jumpZ / 0.22) : 0;
    if (air > 0) {
      const sc = sw ? BL.clamp((sw.t - sw.tc + 0.12) / 0.24, 0, 1) : 0.5;
      fr = lerp2(fr, [0.18, lerp(-0.42, 0.25, sc)], air);
      fl = lerp2(fl, [-0.16, lerp(0.22, -0.3, sc)], air);
      frz += 0.2 * air; flz += 0.16 * air;
      pelvisH += 0.02 * air;
    }

    const pelvisL = [ux * 0.48 * lunge, uy * 0.48 * lunge, pelvisH];

    // ---- thân: nghiêng trước / về phía lao người ----
    const lean = P.ln + lunge * 0.42 + Math.min(0.12, spd * 0.03) * (mvF > -0.3 ? 1 : -0.5);
    const ldx = lerp(0, ux, Math.min(1, lunge * 1.5)), ldy = lerp(1, uy, Math.min(1, lunge * 1.5));
    const ll = Math.hypot(ldx, ldy) || 1;
    const TOR = B.tor;
    const chestL = [pelvisL[0] + ldx / ll * Math.sin(lean) * TOR, pelvisL[1] + ldy / ll * Math.sin(lean) * TOR, pelvisH + Math.cos(lean) * TOR];
    const shR = rot2([B.shw, 0], yaw);
    const rShL = [chestL[0] + shR[0], chestL[1] + shR[1], chestL[2] - 0.035];
    const lShL = [chestL[0] - shR[0], chestL[1] - shR[1], chestL[2] - 0.035];
    // khung tay dựng cho thân chuẩn -> dời theo thân thật
    // khung hình tay dựng cho thân chuẩn cao 1m75 (vai ~1.42 m)
    const STD = [0, Math.sin(READY.ln) * 0.5, 0.87 - READY.sq + Math.cos(READY.ln) * 0.5];
    const dlt = V.sub(chestL, STD);
    const sh = (p) => V.add(p, dlt);

    // ---- tay & vợt ----
    let H = sh(P.h), Rd = V.norm(P.r), Lh = sh(P.l), contactW = null;
    if (set && cl && (seg === 'accel' || seg === 'fol')) {
      // lúc chạm: tâm mặt vợt trùng điểm chạm cầu
      const dv = V.sub(cl, rShL);
      const dist = V.len(dv) || 1;
      const dir = V.mul(dv, 1 / dist);
      const cR = (sw.kind === 'net' || sw.kind === 'serve' || set === KF.net) ? V.norm([dir[0] * 0.7, dir[1] * 0.5 + 0.25, dir[2] * 0.6 + 0.45]) : dir;
      let hv = V.sub(V.sub(cl, V.mul(cR, RACKET_C)), rShL);
      const hl = V.len(hv), maxA = UARM + FARM - 0.03;
      if (hl > maxA) hv = V.mul(hv, maxA / hl);
      if (hl < 0.16) hv = V.mul(dir, 0.16);
      const cH = V.add(rShL, hv);
      contactW = sw.c;
      if (seg === 'accel') { H = lerp3(sh(set.back.h), cH, k); Rd = nlerp(set.back.r, cR, k); }
      else { H = lerp3(cH, sh(set.fol.h), k); Rd = nlerp(cR, set.fol.r, k); }
    } else if (!sw && spd > 0.5 && !s.holding) {
      // chạy: vợt giữ cao trước ngực, tay trái giữ thăng bằng
      const swy = Math.sin(ph) * 0.1 * run;
      H = lerp3(H, sh([0.3, 0.26 + swy * 0.3, 1.2]), run); Lh = lerp3(Lh, sh([-0.32, 0.1 - swy, 1.02]), run);
    }
    const lhL = s.holding && s.heldPos ? W2L(s.heldPos) : Lh;

    const pelvis = L2W(pelvisL), chest = L2W(chestL);
    const rSh = L2W(rShL), lSh = L2W(lShL);
    // hướng khuỷu tay
    const shRw = V.norm(D2W([shR[0], shR[1], 0]));
    const bodyF = V.norm(D2W([-Math.sin(yaw), Math.cos(yaw), 0]));
    let rpole;
    if (P.ep === 'up') rpole = V.add(V.add(V.mul(shRw, 0.75), V.mul(bodyF, -0.25)), [0, 0, 0.6]);
    else if (P.ep === 'front') rpole = V.add(V.add(V.mul(bodyF, 0.7), V.mul(shRw, 0.2)), [0, 0, 0.3]);
    else rpole = V.add(V.add(V.mul(shRw, 0.8), V.mul(bodyF, -0.2)), [0, 0, -0.55]);
    const [rElb, rHand] = ik(rSh, L2W(H), UARM, FARM, rpole);
    const [lElb, lHand] = ik(lSh, L2W(lhL), UARM, FARM, V.add(V.mul(shRw, -0.75), [0, 0, -0.45]));
    const rdW = V.norm(D2W(Rd));
    // mặt vợt quay về hướng đánh (phía trước thân)
    let nrm = V.sub(bodyF, V.mul(rdW, V.dot(bodyF, rdW)));
    if (V.len(nrm) < 0.1) nrm = V.sub(Z, V.mul(rdW, V.dot(Z, rdW)));
    nrm = V.norm(nrm);
    const across = V.norm(V.cross(rdW, nrm));
    const rkHead = V.add(rHand, V.mul(rdW, RACKET_C));

    // ---- chân ----
    const hipR2 = rot2([B.hipw, 0], hy);
    const hipR = L2W([pelvisL[0] + hipR2[0], pelvisL[1] + hipR2[1], pelvisH]);
    const hipL = L2W([pelvisL[0] - hipR2[0], pelvisL[1] - hipR2[1], pelvisH]);
    const ankR = L2W([fr[0], fr[1], frz + B.ankle]), ankL = L2W([fl[0], fl[1], flz + B.ankle]);
    const hipF = V.norm(D2W([-Math.sin(hy), Math.cos(hy), 0])), hipRw = V.norm(D2W([hipR2[0], hipR2[1], 0]));
    const kneeR = ik(hipR, ankR, THIGH, SHIN, V.add(V.add(hipF, V.mul(hipRw, 0.3)), [0, 0, 0.1]))[0];
    const kneeL = ik(hipL, ankL, THIGH, SHIN, V.add(V.add(hipF, V.mul(hipRw, -0.3)), [0, 0, 0.1]))[0];
    // mũi chân: hướng theo hông; chân lao chỉ về điểm chạm
    const toeDir = (side) => {
      if (side > 0 && lunge > 0.25) return V.norm(D2W([ux, uy, 0]));
      return V.norm(V.add(hipF, V.mul(hipRw, side * 0.35)));
    };
    const dR = toeDir(1), dL = toeDir(-1);
    const toeR = V.add(ankR, V.add(V.mul(dR, 0.17), [0, 0, -(B.ankle - 0.02) + (lunge > 0.4 ? 0.04 * lunge : 0)]));
    const toeL = V.add(ankL, V.add(V.mul(dL, 0.17), [0, 0, -(B.ankle - 0.02)]));
    toeR[2] = Math.max(base[2] + 0.02, toeR[2]); toeL[2] = Math.max(base[2] + 0.02, toeL[2]);

    // ---- đầu: nhìn theo cầu ----
    const neck = V.add(chest, [ldx / ll * 0.02 * F[0], ldy / ll * 0.02 * F[1], B.neck]);
    const head = V.add(neck, [bodyF[0] * 0.025, bodyF[1] * 0.025, B.head]);
    let look = bodyF;
    if (s.lookAt) {
      const d = V.sub(s.lookAt, head);
      if (V.len(d) > 0.2) look = V.norm(d);
      // cổ không vặn quá 80°
      const fl2 = Math.hypot(look[0], look[1]);
      const cosA = fl2 > 1e-3 ? (look[0] * F[0] + look[1] * F[1]) / fl2 : 1;
      if (cosA < 0.15) look = V.norm(lerp3(look, V.add(F, [0, 0, look[2]]), 0.6));
      look[2] = BL.clamp(look[2], -0.6, 0.85);
      look = V.norm(look);
    }

    return {
      F, R, base, pelvis, chest, neck, head, look, rSh, lSh, rElb, lElb, rHand, lHand, hipR, hipL, kneeR, kneeL, ankR, ankL, toeR, toeL,
      hipF, hipRw, chestF: bodyF, chestR: shRw,
      racket: { grip: V.sub(rHand, V.mul(rdW, 0.13)), hand: rHand, head: rkHead, dir: rdW, across, normal: nrm },
      contactW,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
