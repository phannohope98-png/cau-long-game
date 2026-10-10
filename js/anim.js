// Khung xương nhân vật (tỉ lệ người thật ~1m75): tư thế chờ, chạy bước, lao người, bật nhảy,
// và các động tác vung vợt có khung hình chính + IK 2 khớp cho tay/chân.
(function (G) {
  const BL = G.BL;
  const V = BL.v3;
  const A = (BL.Anim = {});

  const THIGH = 0.45, SHIN = 0.45, UARM = 0.3, FARM = 0.28, RACKET_C = 0.52;

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

  const lerp3 = V.lerp;
  const nlerp = (a, b, t) => V.norm(V.lerp(a, b, t));
  const ease = BL.smooth;
  const easeIn = (t) => t * t;

  // Khung hình chính theo loại cú đánh (toạ độ địa phương: [phải, trước, cao])
  // h: tay cầm vợt, r: hướng vợt, y: xoay vai (rad, + là vai phải ra trước), l: tay trái
  const KF = {
    over: {
      prep: { h: [0.3, 0.12, 1.3], r: [0.05, 0.25, 1], y: -0.2, l: [-0.3, 0.3, 1.25] },
      back: { h: [0.3, -0.12, 1.55], r: [0.15, -0.35, -1], y: -1.0, l: [-0.2, 0.35, 1.85] },
      fol: { h: [-0.22, 0.38, 0.95], r: [-0.45, 0.35, -1], y: 0.65, l: [-0.3, -0.1, 1.0] },
    },
    side: {
      prep: { h: [0.35, 0.2, 1.2], r: [0.3, 0.4, 1], y: -0.1, l: [-0.3, 0.25, 1.1] },
      back: { h: [0.55, -0.2, 1.3], r: [0.4, -1, 0.35], y: -0.75, l: [-0.35, 0.3, 1.2] },
      fol: { h: [-0.2, 0.45, 1.2], r: [-1, 0.25, 0.25], y: 0.6, l: [-0.35, -0.1, 1.05] },
    },
    sideB: {
      prep: { h: [0.1, 0.3, 1.2], r: [-0.2, 0.4, 1], y: 0.1, l: [-0.3, 0.2, 1.1] },
      back: { h: [-0.3, 0.05, 1.35], r: [-0.5, -0.8, 0.4], y: 0.75, l: [-0.35, -0.2, 1.1] },
      fol: { h: [0.45, 0.35, 1.3], r: [1, 0.35, 0.3], y: -0.4, l: [-0.35, 0.1, 1.05] },
    },
    under: {
      prep: { h: [0.3, 0.3, 1.05], r: [0.15, 0.5, 1], y: -0.05, l: [-0.3, 0.2, 1.05] },
      back: { h: [0.38, -0.05, 0.85], r: [0.25, -0.5, -1], y: -0.45, l: [-0.35, 0.25, 1.15] },
      fol: { h: [0.05, 0.42, 1.55], r: [-0.1, 0.45, 1], y: 0.35, l: [-0.4, -0.05, 1.0] },
    },
    underB: {
      prep: { h: [0.1, 0.32, 1.05], r: [-0.2, 0.5, 1], y: 0.05, l: [-0.3, 0.2, 1.05] },
      back: { h: [-0.3, 0.05, 0.9], r: [-0.4, -0.3, -0.9], y: 0.55, l: [-0.35, 0.0, 1.05] },
      fol: { h: [-0.05, 0.45, 1.45], r: [0.15, 0.4, 1], y: -0.15, l: [-0.35, 0.1, 1.0] },
    },
    net: { // động tác nhỏ, mềm cổ tay
      prep: { h: [0.25, 0.35, 1.0], r: [0.1, 0.6, 0.9], y: 0, l: [-0.35, -0.1, 1.0] },
      back: { h: [0.3, 0.3, 0.95], r: [0.1, 0.3, 1], y: -0.15, l: [-0.45, -0.25, 1.05] },
      fol: { h: [0.22, 0.48, 1.1], r: [0.05, 0.9, 0.6], y: 0.1, l: [-0.45, -0.25, 1.05] },
    },
    serveS: { // giao ngắn trái tay
      prep: { h: [0.02, 0.32, 1.0], r: [-0.3, 0.3, -1], y: 0.1, l: [-0.15, 0.4, 1.0] },
      back: { h: [-0.05, 0.22, 0.95], r: [-0.35, 0.1, -1], y: 0.15, l: [-0.15, 0.42, 1.0] },
      fol: { h: [0.0, 0.42, 1.08], r: [-0.25, 0.7, -0.5], y: 0.1, l: [-0.3, 0.1, 0.95] },
    },
    serveH: { // giao cao thuận tay
      prep: { h: [0.3, 0.1, 1.1], r: [0.2, 0.2, 1], y: -0.3, l: [-0.15, 0.42, 1.05] },
      back: { h: [0.45, -0.3, 1.25], r: [0.3, -0.6, 0.7], y: -0.7, l: [-0.15, 0.42, 1.0] },
      fol: { h: [-0.1, 0.4, 1.6], r: [-0.3, 0.4, 1], y: 0.5, l: [-0.4, -0.05, 1.0] },
    },
  };
  const READY = { h: [0.28, 0.32, 1.18], r: [0.12, 0.45, 1], y: 0, l: [-0.28, 0.25, 1.08] };

  function swingSet(sw) {
    if (sw.kind === 'serve') return sw.shot === 'serve_short' ? KF.serveS : KF.serveH;
    const z = sw.c ? sw.c[2] : 1;
    if (sw.kind === 'net' && z < 1.4) return KF.net;
    if (z >= 1.85) return KF.over;
    if (z >= 0.95) return sw.fh ? KF.side : KF.sideB;
    return sw.fh ? KF.under : KF.underB;
  }

  // Tính tư thế: trả về các khớp trong không gian thế giới
  A.pose = function (s) {
    const fx = Math.cos(s.face), fy = Math.sin(s.face);
    const F = [fx, fy, 0], R = [fy, -fx, 0], Z = [0, 0, 1];
    const base = [s.x, s.y, s.jumpZ || 0];
    const L2W = (l) => [base[0] + R[0] * l[0] + F[0] * l[1], base[1] + R[1] * l[0] + F[1] * l[1], base[2] + l[2]];
    const W2L = (w) => { const d = [w[0] - base[0], w[1] - base[1], w[2] - base[2]]; return [d[0] * R[0] + d[1] * R[1], d[0] * F[0] + d[1] * F[1], d[2]]; };
    const sw = s.sw;
    const cl = sw && sw.c ? W2L(sw.c) : null;

    // ---- chân: bước chạy (chân bám sàn theo pha bước) ----
    const spd = Math.hypot(s.vx, s.vy);
    const mvR = spd > 0.05 ? (s.vx * R[0] + s.vy * R[1]) / spd : 0;
    const mvF = spd > 0.05 ? (s.vx * F[0] + s.vy * F[1]) / spd : 0;
    const amp = BL.clamp(spd * 0.13, 0, 0.42);
    const ph = s.gait;
    const lunge = s.lunge || 0;
    const run = Math.min(1, spd / 2);
    let pelvisH = 0.87 - Math.min(0.05, spd * 0.012) - Math.abs(Math.cos(ph)) * 0.03 * run;
    const lA = Math.sin(ph) * amp, rA = -Math.sin(ph) * amp;
    let lf = [-0.16 + mvR * lA, -0.02 + mvF * lA, Math.max(0, Math.cos(ph)) * 0.14 * run];
    let rf = [0.17 + mvR * rA, -0.1 + mvF * rA, Math.max(0, -Math.cos(ph)) * 0.14 * run];

    // hướng lao người: về phía điểm chạm
    let ux = 0, uy = 1;
    if (cl) { const dl = Math.hypot(cl[0], cl[1]); if (dl > 0.05) { ux = cl[0] / dl; uy = cl[1] / dl; } }
    if (lunge > 0.01 && cl) {
      const step = 1.0 * lunge;
      rf = V.lerp(rf, [ux * step + 0.1 * uy, uy * step - 0.1 * ux, 0], Math.min(1, lunge * 1.2));
      lf = V.lerp(lf, [-ux * 0.35 - 0.12 * uy, -uy * 0.35 + 0.12 * ux, 0], lunge * 0.85);
      pelvisH -= 0.3 * lunge;
    }
    if (s.jumpZ > 0.02) { // trên không: co gối, chân phải kéo ra sau (kiểu bật nhảy đập)
      const k = Math.min(1, s.jumpZ / 0.25);
      lf[2] += 0.14 * k; lf[1] += 0.1 * k; rf[2] += 0.24 * k; rf[1] -= 0.22 * k;
    }
    const pelvisL = [ux * 0.48 * lunge, uy * 0.48 * lunge, pelvisH];

    // ---- pha vung vợt ----
    let set = null, seg = 'ready', k = 0;
    if (sw) {
      set = swingSet(sw);
      if (sw.t < sw.tc) { const u = sw.t / sw.tc; if (u < 0.6) { seg = 'wind'; k = ease(u / 0.6); } else { seg = 'accel'; k = easeIn((u - 0.6) / 0.4); } }
      else { const v = (sw.t - sw.tc) / Math.max(0.05, sw.dur - sw.tc); if (v < 0.55) { seg = 'fol'; k = ease(v / 0.55); } else { seg = 'rec'; k = ease((v - 0.55) / 0.45); } }
    }
    const CY = 0.15; // vai lúc chạm
    let yaw = 0;
    if (set) {
      if (seg === 'wind') yaw = BL.lerp(READY.y, set.back.y, k);
      else if (seg === 'accel') yaw = BL.lerp(set.back.y, CY, k);
      else if (seg === 'fol') yaw = BL.lerp(CY, set.fol.y, k);
      else yaw = BL.lerp(set.fol.y, READY.y, k);
    } else if (s.holding) yaw = -0.2;

    // ---- thân: nghiêng về phía trước / phía lao người ----
    const lean = 0.13 + lunge * 0.5 + Math.min(0.15, spd * 0.03) + (seg === 'fol' && set === KF.over ? 0.25 * k : 0);
    const ldx = BL.lerp(0, ux, Math.min(1, lunge * 1.5)), ldy = BL.lerp(1, uy, Math.min(1, lunge * 1.5));
    const ll = Math.hypot(ldx, ldy) || 1;
    const TOR = 0.5;
    const chestL = [pelvisL[0] + ldx / ll * Math.sin(lean) * TOR, pelvisL[1] + ldy / ll * Math.sin(lean) * TOR, pelvisH + Math.cos(lean) * TOR];
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const SHW = 0.2;
    const rShL = [chestL[0] + cyw * SHW, chestL[1] + syw * SHW, chestL[2] - 0.03];
    const lShL = [chestL[0] - cyw * SHW, chestL[1] - syw * SHW, chestL[2] - 0.03];
    // khung hình tay được dựng cho thân chuẩn -> dời theo thân thật
    const STD = [0, Math.sin(0.13) * TOR, 0.87 + Math.cos(0.13) * TOR];
    const dlt = V.sub(chestL, STD);
    const sh = (p) => V.add(p, dlt);

    // ---- tay & vợt ----
    let H = sh(READY.h), Rd = READY.r, Lh = sh(READY.l), contactW = null;
    if (set) {
      let cH = sh(set.back.h), cR = [0, 0.3, 1];
      if (cl) {
        // tại lúc chạm: tay đặt sao cho tâm mặt vợt trùng điểm chạm cầu
        const dv = V.sub(cl, rShL);
        const dist = V.len(dv) || 1;
        const dir = V.mul(dv, 1 / dist);
        cR = (sw.kind === 'net' || sw.kind === 'serve') ? V.norm([dir[0] * 0.7, dir[1] * 0.5 + 0.25, dir[2] * 0.6 + 0.45]) : dir;
        // tay = điểm chạm - hướng vợt * chiều dài tới tâm mặt vợt (giới hạn theo độ dài tay)
        let hv = V.sub(V.sub(cl, V.mul(cR, RACKET_C)), rShL);
        const hl = V.len(hv), maxA = UARM + FARM - 0.03;
        if (hl > maxA) hv = V.mul(hv, maxA / hl);
        if (hl < 0.16) hv = V.mul(dir, 0.16);
        cH = V.add(rShL, hv);
        contactW = sw.c;
      }
      const pr = { h: sh(READY.h), r: READY.r, l: sh(READY.l) };
      const bk = { h: sh(set.back.h), r: set.back.r, l: sh(set.back.l) };
      const fo = { h: sh(set.fol.h), r: set.fol.r, l: sh(set.fol.l) };
      const ct = { h: cH, r: cR, l: V.lerp(bk.l, fo.l, 0.6) };
      const pairs = { wind: [pr, bk], accel: [bk, ct], fol: [ct, fo], rec: [fo, pr] }[seg];
      H = lerp3(pairs[0].h, pairs[1].h, k);
      Rd = nlerp(pairs[0].r, pairs[1].r, k);
      Lh = lerp3(pairs[0].l, pairs[1].l, k);
    } else if (s.holding) {
      H = sh([0.32, 0.02, 1.02]); Rd = V.norm([0.3, -0.3, -1]);
    } else if (spd > 0.4) {
      const swy = Math.sin(ph) * 0.1 * run;
      H = sh([0.3, 0.28 + swy * 0.4, 1.12]); Lh = sh([-0.3, 0.12 - swy, 1.0]);
    }
    const lhL = s.holding && s.heldPos ? W2L(s.heldPos) : Lh;

    const pelvis = L2W(pelvisL), chest = L2W(chestL);
    const rSh = L2W(rShL), lSh = L2W(lShL);
    const overWind = set === KF.over && (seg === 'wind' || seg === 'accel');
    const rpole = overWind ? V.add(V.mul(R, 0.9), [0, 0, 0.4]) : V.add(V.add(V.mul(R, 0.75), V.mul(F, -0.25)), [0, 0, -0.6]);
    const [rElb, rHand] = ik(rSh, L2W(H), UARM, FARM, rpole);
    const [lElb, lHand] = ik(lSh, L2W(lhL), UARM, FARM, V.add(V.mul(R, -0.75), [0, 0, -0.5]));
    const rdW = V.norm([R[0] * Rd[0] + F[0] * Rd[1], R[1] * Rd[0] + F[1] * Rd[1], Rd[2]]);
    const rkHead = V.add(rHand, V.mul(rdW, RACKET_C));
    let across = V.cross(rdW, Z);
    if (V.len(across) < 0.2) across = V.cross(rdW, F);
    across = V.norm(across);

    // ---- chân ----
    const hy = yaw * 0.45, chy = Math.cos(hy), shy = Math.sin(hy);
    const hipR = L2W([pelvisL[0] + chy * 0.1, pelvisL[1] + shy * 0.1, pelvisH]);
    const hipL = L2W([pelvisL[0] - chy * 0.1, pelvisL[1] - shy * 0.1, pelvisH]);
    const ankR = L2W([rf[0], rf[1], rf[2] + 0.075]), ankL = L2W([lf[0], lf[1], lf[2] + 0.075]);
    const kp = V.add(F, [0, 0, 0.1]);
    const kneeR = ik(hipR, ankR, THIGH, SHIN, V.add(kp, V.mul(R, 0.3)))[0];
    const kneeL = ik(hipL, ankL, THIGH, SHIN, V.add(kp, V.mul(R, -0.3)))[0];
    // bàn chân hướng theo chân (lao người: mũi chân phải chỉ về điểm chạm)
    const fR = lunge > 0.2 ? V.norm([R[0] * ux + F[0] * uy, R[1] * ux + F[1] * uy, 0]) : V.norm(V.add(F, V.mul(R, 0.25)));
    const fL = V.norm(V.add(F, V.mul(R, -0.3)));
    const toeR = V.add(ankR, V.add(V.mul(fR, 0.18), [0, 0, -0.05]));
    const toeL = V.add(ankL, V.add(V.mul(fL, 0.18), [0, 0, -0.05]));
    toeR[2] = Math.max(base[2] + 0.02, toeR[2]); toeL[2] = Math.max(base[2] + 0.02, toeL[2]);

    const neck = V.add(chest, [F[0] * 0.02, F[1] * 0.02, 0.06]);
    const head = V.add(neck, [F[0] * 0.03, F[1] * 0.03, 0.16]);
    return {
      F, R, base, pelvis, chest, neck, head, rSh, lSh, rElb, lElb, rHand, lHand, hipR, hipL, kneeR, kneeL, ankR, ankL, toeR, toeL,
      racket: { grip: V.sub(rHand, V.mul(rdW, 0.12)), hand: rHand, head: rkHead, dir: rdW, across },
      contactW,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
