// Người thật 3D: mô hình người có da/khung xương (đầu, mặt, bàn tay 5 ngón thật — Ready Player Me, ví dụ của three.js),
// mặc đồ thi đấu cầu lông tự may bám theo xương (áo cộc tay, quần short, tất, giày, tay chân có cơ),
// tóc ngắn, da màu châu Á. Mỗi khung hình: xoay từng xương theo tư thế từ BL.Anim.pose() (aim theo hướng
// khớp + trục phụ để không xoắn), ngón tay cuộn nắm cán vợt kiểu bắt tay.
(function () {
  const BL = window.BL;
  const T = window.THREE;
  if (!T || !T.GLTFLoader || !T.SkeletonUtils) return;

  const URLS = [
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/readyplayer.me.glb',
    'https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/readyplayer.me.glb',
  ];
  const Rig = (BL.HumanRig = { ready: false, failed: false });
  const V3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  const Z = new T.Vector3(0, 0, 1);

  Rig.load = function (cb) {
    let i = 0;
    const next = () => {
      if (i >= URLS.length) { Rig.failed = true; if (cb) cb(false); return; }
      new T.GLTFLoader().load(URLS[i++], (g) => {
        Rig.gltf = g;
        try { prepare(); Rig.ready = true; if (cb) cb(true); } catch (e) { console.warn('rig', e); Rig.failed = true; if (cb) cb(false); }
      }, undefined, next);
    };
    next();
  };

  // ---------- đo khung xương ở tư thế gốc + dựng hình học quần áo (dùng chung cho mọi người) ----------
  let TPL = null;
  function prepare() {
    const inst = makeInstance();
    const b = inst.bones, W = (n) => b[n].getWorldPosition(new T.Vector3());
    const hips = W('Hips'), rA = W('RightArm'), lA = W('LeftArm'), rF = W('RightForeArm'), rH = W('RightHand');
    const rU = W('RightUpLeg'), lU = W('LeftUpLeg'), rL = W('RightLeg'), rFt = W('RightFoot'), neck = W('Neck'), head = W('Head');
    const thigh = rU.distanceTo(rL), shin = rL.distanceTo(rFt), ankle = rFt.z;
    const body = {
      thigh, shin, uarm: rA.distanceTo(rF), farm: rF.distanceTo(rH), ankle,
      pelvis: thigh + shin + ankle - 0.1,
      tor: rA.z - hips.z + 0.035,
      shw: Math.hypot(rA.x - lA.x, rA.y - lA.y) / 2,
      hipw: Math.hypot(rU.x - lU.x, rU.y - lU.y) / 2,
      neck: neck.z - (rA.z + 0.035) + 0.02,
      head: head.z - neck.z,
      racketC: 0.47,
    };
    BL.Anim.setBody(body);
    TPL = { body, garments: buildGarments(inst), hair: buildHair(inst), skinAvg: sampleSkin(inst) };
  }

  // Một bản sao mô hình: ẩn vest/mũ/ria, lấy xương
  function makeInstance() {
    const src = Rig.gltf.scene;
    const root = T.SkeletonUtils.clone(src);
    const group = new T.Group();
    root.rotation.x = Math.PI / 2; // glTF trục Y lên -> thế giới trục Z lên
    group.add(root);
    const bones = {}, meshes = {};
    root.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) {
        meshes[o.name] = o;
        o.castShadow = true;
        o.frustumCulled = false;
        if (/Outfit|Headwear|Beard/.test(o.name)) o.visible = false;
      }
    });
    group.updateMatrixWorld(true);
    return { group, root, bones, meshes };
  }

  // ---------- may quần áo & tay chân bám xương ----------
  const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase'];
  const BI = {}; BONES.forEach((n, i) => (BI[n] = i));

  // vòng mặt cắt: tâm c, trục u (bán kính a), trục v (bán kính b), trọng số xương w = [[tên, w], ...]
  function tube(rings, seg, closeStart, closeEnd) {
    const pos = [], si = [], sw = [], idx = [];
    const pushV = (p, w) => {
      pos.push(p.x, p.y, p.z);
      const ws = w.slice(0, 4).filter((x) => x[1] > 0);
      let tot = ws.reduce((a, x) => a + x[1], 0) || 1;
      for (let k = 0; k < 4; k++) { si.push(ws[k] ? BI[ws[k][0]] : 0); sw.push(ws[k] ? ws[k][1] / tot : 0); }
    };
    rings.forEach((r) => {
      for (let j = 0; j < seg; j++) {
        const t = (j / seg) * Math.PI * 2;
        const ca = Math.cos(t), sa = Math.sin(t);
        const a = r.fa ? r.fa(t) : r.a, bb = r.fb ? r.fb(t) : r.b;
        const p = r.c.clone().addScaledVector(r.u, ca * a).addScaledVector(r.v, sa * bb);
        pushV(p, typeof r.w === 'function' ? r.w(p, t) : r.w);
      }
    });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b2 = i * seg + ((j + 1) % seg), c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg);
      idx.push(a, c, b2, b2, c, d);
    }
    const cap = (ri, flip) => {
      const r = rings[ri], base = pos.length / 3;
      pushV(r.c, typeof r.w === 'function' ? r.w(r.c, 0) : r.w);
      for (let j = 0; j < seg; j++) { const a = ri * seg + j, b2 = ri * seg + ((j + 1) % seg); if (flip) idx.push(base, b2, a); else idx.push(base, a, b2); }
    };
    if (closeStart) cap(0, false);
    if (closeEnd) cap(rings.length - 1, true);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  function orth(a, ref) { const r = ref.clone().addScaledVector(a, -ref.dot(a)); return r.normalize(); }

  function buildGarments(inst) {
    const b = inst.bones, W = (n) => b[n].getWorldPosition(new T.Vector3());
    const R0 = W('RightUpLeg').sub(W('LeftUpLeg')).setZ(0).normalize();
    const F0 = new T.Vector3().crossVectors(Z, R0).normalize();
    const hips = W('Hips'), sp = W('Spine'), sp1 = W('Spine1'), sp2 = W('Spine2'), neck = W('Neck');
    const G = {};
    // --- thân áo: elip theo chiều cao, xương sống chia trọng số theo độ cao ---
    const shZ = W('RightArm').z;
    const H0 = hips.z - 0.03, H1 = neck.z + 0.045;
    const spineW = (p) => {
      const z = p.z;
      const pts = [[hips.z, 'Hips'], [sp.z, 'Spine'], [sp1.z, 'Spine1'], [sp2.z + 0.06, 'Spine2'], [neck.z + 0.02, 'Neck']];
      let w = [[pts[0][1], 1]];
      for (let i = 0; i < pts.length - 1; i++) {
        if (z >= pts[i][0] && z < pts[i + 1][0]) { const k = smooth((z - pts[i][0]) / (pts[i + 1][0] - pts[i][0])); w = [[pts[i][1], 1 - k], [pts[i + 1][1], k]]; }
        if (z >= pts[pts.length - 1][0]) w = [[pts[pts.length - 1][1], 1]];
      }
      // vai áo đi theo cánh tay
      const lat = p.clone().sub(hips).dot(R0);
      if (z > shZ - 0.12 && Math.abs(lat) > 0.11) {
        const k = smooth((Math.abs(lat) - 0.13) / 0.06) * smooth((z - (shZ - 0.08)) / 0.1) * 0.35;
        const side = lat > 0 ? 'Right' : 'Left';
        w = w.map((x) => [x[0], x[1] * (1 - k)]).concat([[side + 'Shoulder', k * 0.45], [side + 'Arm', k * 0.55]]);
      }
      return w;
    };
    // [độ cao tương đối từ hông tới cổ, nửa rộng, nửa dày, lệch trước]
    const prof = [[0, 0.165, 0.118, 0], [0.12, 0.158, 0.112, 0], [0.3, 0.146, 0.104, 0.004], [0.48, 0.154, 0.11, 0.01], [0.64, 0.166, 0.12, 0.016], [0.78, 0.176, 0.116, 0.012], [0.87, 0.18, 0.106, 0.0], [0.93, 0.155, 0.094, -0.005], [0.975, 0.1, 0.08, -0.004], [1.0, 0.078, 0.068, -0.002]];
    const shirtRings = prof.map(([h, a, bb, fwd]) => {
      const z = H0 + (H1 - H0) * h;
      const c = new T.Vector3(hips.x, hips.y, z).addScaledVector(F0, fwd);
      return { c, u: R0, v: F0, a, b: bb, w: spineW };
    });
    G.shirt = tube(shirtRings, 28, true, false);
    // cổ áo (viền)
    const collarC = new T.Vector3(hips.x, hips.y, H1 - 0.005);
    G.collar = tube([{ c: collarC.clone().setZ(H1 - 0.02), u: R0, v: F0, a: 0.082, b: 0.074, w: [['Spine2', 0.5], ['Neck', 0.5]] }, { c: collarC.clone().setZ(H1 + 0.006), u: R0, v: F0, a: 0.074, b: 0.068, w: [['Neck', 1]] }], 24, false, false);
    // --- tay áo + tay ---
    for (const s of ['Right', 'Left']) {
      const A = W(s + 'Arm'), Fa = W(s + 'ForeArm'), Hd = W(s + 'Hand');
      const ua = Fa.clone().sub(A).normalize(), fa = Hd.clone().sub(Fa).normalize();
      const u1 = orth(ua, F0), v1 = new T.Vector3().crossVectors(ua, u1);
      const ring = (p, dir, u, v, a, bb, w) => ({ c: p, u, v, a, b: bb, w });
      const L = A.distanceTo(Fa);
      G['sleeve' + s] = tube([
        ring(A.clone().addScaledVector(ua, -0.07), ua, u1, v1, 0.045, 0.05, [[s + 'Shoulder', 0.5], [s + 'Arm', 0.5]]),
        ring(A.clone().addScaledVector(ua, -0.01), ua, u1, v1, 0.062, 0.064, [[s + 'Shoulder', 0.2], [s + 'Arm', 0.8]]),
        ring(A.clone().addScaledVector(ua, 0.05), ua, u1, v1, 0.062, 0.063, [[s + 'Arm', 1]]),
        ring(A.clone().addScaledVector(ua, 0.12), ua, u1, v1, 0.058, 0.059, [[s + 'Arm', 1]]),
        ring(A.clone().addScaledVector(ua, 0.145), ua, u1, v1, 0.057, 0.058, [[s + 'Arm', 1]]),
      ], 22, true, false);
      // bắp tay (cơ nhị đầu phía trước, tam đầu phía sau)
      const armP = [[0.25, 0.051, 0.052], [0.45, 0.049, 0.054], [0.65, 0.044, 0.048], [0.85, 0.039, 0.041], [1.0, 0.037, 0.038]];
      G['uarm' + s] = tube(armP.map(([k, a, bb]) => ring(A.clone().addScaledVector(ua, L * k), ua, u1, v1, a, bb, k > 0.9 ? [[s + 'Arm', 0.6], [s + 'ForeArm', 0.4]] : [[s + 'Arm', 1]])), 18, false, false);
      const Lf = Fa.distanceTo(Hd);
      const u2 = orth(fa, F0), v2 = new T.Vector3().crossVectors(fa, u2);
      const faP = [[-0.04, 0.038, 0.04], [0.12, 0.042, 0.044], [0.3, 0.041, 0.04], [0.6, 0.033, 0.03], [0.88, 0.027, 0.022], [1.02, 0.025, 0.02]];
      G['farm' + s] = tube(faP.map(([k, a, bb]) => ring(Fa.clone().addScaledVector(fa, Lf * k), fa, u2, v2, a, bb, k < 0.05 ? [[s + 'Arm', 0.45], [s + 'ForeArm', 0.55]] : k > 0.9 ? [[s + 'ForeArm', 0.6], [s + 'Hand', 0.4]] : [[s + 'ForeArm', 1]])), 18, false, false);
    }
    // --- quần short ---
    const pelvisRings = [[0.16, 0.18, 0.13], [0.06, 0.182, 0.135], [-0.04, 0.178, 0.128], [-0.09, 0.165, 0.115]].map(([dz, a, bb]) => ({ c: new T.Vector3(hips.x, hips.y, hips.z + dz).addScaledVector(F0, -0.005), u: R0, v: F0, a, b: bb, w: [['Hips', 1]] }));
    G.shortsTop = tube(pelvisRings, 28, false, true);
    for (const s of ['Right', 'Left']) {
      const U = W(s + 'UpLeg'), K = W(s + 'Leg'), Ft = W(s + 'Foot');
      const td = K.clone().sub(U).normalize();
      const u = orth(td, R0), v = new T.Vector3().crossVectors(td, u);
      const off = R0.clone().multiplyScalar(s === 'Right' ? 0.012 : -0.012);
      const ring = (k, a, bb, w, len) => ({ c: U.clone().addScaledVector(td, (len || 1) * k).add(off), u, v, a, b: bb, w });
      const L = U.distanceTo(K);
      G['shortsLeg' + s] = tube([ring(-0.06, 0.112, 0.112, [['Hips', 0.6], [s + 'UpLeg', 0.4]], L), ring(0.1, 0.108, 0.106, [['Hips', 0.25], [s + 'UpLeg', 0.75]], L), ring(0.3, 0.1, 0.098, [[s + 'UpLeg', 1]], L), ring(0.42, 0.097, 0.095, [[s + 'UpLeg', 1]], L), ring(0.44, 0.099, 0.097, [[s + 'UpLeg', 1]], L)], 24, false, false);
      // đùi
      const thP = [[0.3, 0.083, 0.085], [0.5, 0.078, 0.079], [0.7, 0.068, 0.066], [0.88, 0.056, 0.054], [1.0, 0.051, 0.05]];
      G['thigh' + s] = tube(thP.map(([k, a, bb]) => ({ c: U.clone().addScaledVector(td, L * k).add(off.clone().multiplyScalar(1 - k)), u, v, a, b: bb, w: k > 0.92 ? [[s + 'UpLeg', 0.55], [s + 'Leg', 0.45]] : [[s + 'UpLeg', 1]] })), 20, false, false);
      // cẳng chân: bắp chân phồng phía sau
      const sd = Ft.clone().sub(K).normalize(), Ls = K.distanceTo(Ft);
      const u3 = orth(sd, R0), v3 = new T.Vector3().crossVectors(sd, u3); // v3 ~ phía trước/sau
      const back = F0.clone().multiplyScalar(-1);
      const shP = [[-0.03, 0.05, 0.05, 0], [0.12, 0.053, 0.056, 0.006], [0.3, 0.055, 0.062, 0.014], [0.5, 0.047, 0.05, 0.008], [0.7, 0.038, 0.04, 0.003], [0.9, 0.033, 0.034, 0], [1.0, 0.032, 0.033, 0]];
      G['shin' + s] = tube(shP.map(([k, a, bb, bk]) => ({ c: K.clone().addScaledVector(sd, Ls * k).addScaledVector(back, bk), u: u3, v: v3, a, b: bb, w: k < 0.05 ? [[s + 'UpLeg', 0.4], [s + 'Leg', 0.6]] : k > 0.92 ? [[s + 'Leg', 0.7], [s + 'Foot', 0.3]] : [[s + 'Leg', 1]] })), 20, false, false);
      // tất
      G['sock' + s] = tube([[0.72, 0.04, 0.042], [0.85, 0.039, 0.041], [1.02, 0.037, 0.039]].map(([k, a, bb]) => ({ c: K.clone().addScaledVector(sd, Ls * k), u: u3, v: v3, a, b: bb, w: k > 0.95 ? [[s + 'Leg', 0.6], [s + 'Foot', 0.4]] : [[s + 'Leg', 1]] })), 18, false, false);
      // giày: đế phẳng sát sàn + thân giày
      const Tb = W(s + 'ToeBase');
      const fd = Tb.clone().sub(Ft).setZ(0).normalize();
      const fr = new T.Vector3().crossVectors(fd, Z).normalize();
      const shoeW = (k) => (k < 0.55 ? [[s + 'Foot', 1]] : k < 0.75 ? [[s + 'Foot', 0.5], [s + 'ToeBase', 0.5]] : [[s + 'ToeBase', 1]]);
      const heel = new T.Vector3(Ft.x, Ft.y, 0).addScaledVector(fd, -0.075);
      const Lshoe = 0.285;
      const upP = [[0, 0.03, 0.05, 0.055], [0.06, 0.042, 0.062, 0.068], [0.25, 0.047, 0.07, 0.072], [0.45, 0.049, 0.054, 0.058], [0.62, 0.052, 0.04, 0.045], [0.8, 0.047, 0.03, 0.034], [0.93, 0.034, 0.022, 0.025], [1.0, 0.012, 0.012, 0.018]];
      G['shoe' + s] = tube(upP.map(([k, a, bb, zc]) => ({ c: heel.clone().addScaledVector(fd, Lshoe * k).setZ(0.018 + zc * 0.55), u: fr, v: Z, a, b: bb, w: shoeW(k) })), 22, true, true);
      const soleP = [[0, 0.03], [0.05, 0.045], [0.3, 0.048], [0.6, 0.054], [0.85, 0.048], [1.0, 0.02]];
      G['sole' + s] = tube(soleP.map(([k, a]) => ({ c: heel.clone().addScaledVector(fd, Lshoe * k).setZ(0.011), u: fr, v: Z, a: a + 0.004, b: 0.011, w: shoeW(k) })), 18, true, true);
    }
    // --- tóc ngắn thể thao: chỏm cầu ôm sọ, mép tóc lượn tự nhiên ---
    const hd = W('Head'), top = W('HeadTop_End');
    const up = top.clone().sub(hd).normalize();
    const ctr = hd.clone().addScaledVector(up, 0.085).addScaledVector(F0, -0.004);
    const rings = [];
    const NR = 9;
    for (let i = 0; i <= NR; i++) {
      const th = (i / NR) * 1.95; // góc từ đỉnh
      const fa = (t) => {
        // t: 0 = phải, PI/2 = trước. Trước trán tóc dừng sớm, sau gáy xuống thấp, mai tóc ở thái dương
        const front = Math.max(0, Math.sin(t)), backk = Math.max(0, -Math.sin(t));
        const lim = 1.3 + backk * 0.65 + (1 - front - backk) * 0.42;
        const tt = Math.min(th, lim);
        const r = 0.1035 + 0.004 * Math.sin(t * 7 + i) * (i > 2 ? 1 : 0.3);
        return Math.sin(tt) * r;
      };
      const hz = (t) => { const front = Math.max(0, Math.sin(t)), backk = Math.max(0, -Math.sin(t)); const lim = 1.3 + backk * 0.65 + (1 - front - backk) * 0.42; return Math.cos(Math.min(th, lim)) * 0.1035; };
      rings.push({ i, th, fa, hz });
    }
    // dựng thủ công vì tâm vòng thay đổi theo góc
    const pos = [], si = [], sw = [], idx = [], SEG = 32;
    rings.forEach((r) => {
      for (let j = 0; j < SEG; j++) {
        const t = (j / SEG) * Math.PI * 2;
        const rad = r.fa(t);
        const p = ctr.clone().addScaledVector(up, r.hz(t)).addScaledVector(R0, Math.cos(t) * rad).addScaledVector(F0, Math.sin(t) * rad * 1.08);
        pos.push(p.x, p.y, p.z); si.push(BI.Head, 0, 0, 0); sw.push(1, 0, 0, 0);
      }
    });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < SEG; j++) {
      const a = i * SEG + j, b2 = i * SEG + ((j + 1) % SEG), c = (i + 1) * SEG + j, d = (i + 1) * SEG + ((j + 1) % SEG);
      idx.push(a, b2, c, b2, d, c);
    }
    const hg = new T.BufferGeometry();
    hg.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    hg.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
    hg.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
    hg.setIndex(idx); hg.computeVertexNormals();
    G.hair = hg;
    // vợt dài 67.5 cm theo chuẩn
    return G;
  }

  // Tóc: lấy bề mặt da đầu thật của mô hình (phần trên đường chân tóc), đẩy phồng theo pháp tuyến -> ôm sát sọ
  function buildHair(inst) {
    const head = inst.meshes.Wolf3D_Head;
    const g = head.geometry;
    const P = g.attributes.position, N = g.attributes.normal;
    g.computeBoundingBox();
    const bb = g.boundingBox, c = bb.getCenter(new T.Vector3()), top = bb.max.y;
    // chiều cao mắt ~ giữa đầu; đường chân tóc: trán cao, thái dương, gáy thấp
    const keep = new Uint8Array(P.count);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) - c.x, y = P.getY(i), z = P.getZ(i) - c.z;
      const r = Math.hypot(x, z) || 1;
      const front = Math.max(0, z / r), back = Math.max(0, -z / r);
      const line = top - 0.085 + 0.0 * front - 0.06 * back - 0.03 * (1 - front - back) + front * 0.0;
      let ok = y > line + front * 0.012;
      if (Math.abs(x) > 0.066 && y < top - 0.09) ok = false; // chừa tai
      keep[i] = ok ? 1 : 0;
    }
    const idx = g.index.array, out = [];
    for (let t = 0; t < idx.length; t += 3) if (keep[idx[t]] && keep[idx[t + 1]] && keep[idx[t + 2]]) out.push(idx[t], idx[t + 1], idx[t + 2]);
    const hg = g.clone();
    hg.setIndex(out);
    const hp = hg.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      if (!keep[i]) continue;
      const y = hp.getY(i);
      const k = 0.005 + 0.007 * Math.max(0, (y - (top - 0.07)) / 0.07) + Math.sin(i * 12.9898) * 0.0012;
      hp.setXYZ(i, hp.getX(i) + N.getX(i) * k, y + N.getY(i) * k, hp.getZ(i) + N.getZ(i) * k);
    }
    hg.computeVertexNormals();
    return hg;
  }
  // màu da trung bình của kết cấu bàn tay/cổ để da tự dựng cùng tông
  function sampleSkin(inst) {
    try {
      const img = inst.meshes.Wolf3D_Body.material.map.image;
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
      const d = x.getImageData(0, 0, 64, 64).data;
      let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200 || d[i] + d[i + 1] + d[i + 2] < 60) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      return n ? new T.Color(`rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`) : null;
    } catch (e) { return null; }
  }

  // ---------- kết cấu ----------
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping;
    if (rep) t.repeat.set(rep[0], rep[1]);
    return t;
  }
  let FABRIC = null, HAIRTEX = null, STR = null;
  const fabricTex = () => FABRIC || (FABRIC = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.07})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.strokeStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < w; i += 3) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); }
  }, [6, 6]));
  const hairTex = () => HAIRTEX || (HAIRTEX = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      const px = Math.random() * w, py = Math.random() * h, l = 4 + Math.random() * 10;
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.3)';
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 3, py + l); x.stroke();
    }
  }, [3, 3]));
  const stringTex = () => STR || (STR = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.strokeStyle = 'rgba(245,245,238,0.95)'; x.lineWidth = 1.1;
    for (let i = 0; i <= 128; i += 7) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    return new T.CanvasTexture(c);
  })());

  // ---------- một vận động viên ----------
  function Person(kit) {
    const inst = makeInstance();
    this.group = inst.group; this.bones = inst.bones; this.root = inst.root;
    const b = this.bones;
    // da: nhuộm tông da châu Á, giữ chi tiết mặt của kết cấu gốc
    const skinTint = new T.Color('#ffffff').lerp(new T.Color(kit.skin || '#e0aa82'), 0.6);
    for (const n of ['Wolf3D_Head', 'Wolf3D_Body']) {
      const m = inst.meshes[n];
      if (m) { m.material = m.material.clone(); m.material.color.copy(skinTint); m.material.roughness = 0.62; }
    }
    // da phần tự dựng: cùng tông với kết cấu da gốc đã nhuộm
    const skinCol = (TPL.skinAvg ? TPL.skinAvg.clone() : new T.Color('#c99a7e')).multiply(skinTint);
    const std = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0, side: T.DoubleSide }, o));
    const shirtC = new T.Color(kit.color || '#d33');
    const M = {
      skin: std({ color: skinCol, roughness: 0.6 }),
      shirt: std({ color: shirtC, roughness: 0.78, map: fabricTex(), side: T.DoubleSide }),
      collar: std({ color: '#ffffff', roughness: 0.7 }),
      shorts: std({ color: kit.shorts || '#1b1d28', roughness: 0.82, map: fabricTex(), side: T.DoubleSide }),
      sock: std({ color: '#f5f5f2', roughness: 0.9, map: fabricTex() }),
      shoe: std({ color: '#f7f7f7', roughness: 0.42 }),
      sole: std({ color: shirtC.clone().lerp(new T.Color('#ffffff'), 0.25), roughness: 0.6 }),
      hair: std({ color: kit.hair || '#14100c', roughness: 0.75, map: hairTex() }),
    };
    this.mat = M;
    // xương cho quần áo theo đúng thứ tự BONES
    const list = BONES.map((n) => b[n]);
    const skel = new T.Skeleton(list);
    const G = TPL.garments;
    const add = (geo, mat) => {
      const m = new T.SkinnedMesh(geo, mat);
      m.bind(skel, new T.Matrix4());
      m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
      this.group.add(m);
      return m;
    };
    add(G.shirt, M.shirt); add(G.collar, M.collar); add(G.shortsTop, M.shorts);
    // tóc bám xương đầu theo chính khung xương của đầu
    const headM = inst.meshes.Wolf3D_Head;
    const hair = new T.SkinnedMesh(TPL.hair, M.hair);
    hair.bind(headM.skeleton, headM.bindMatrix);
    hair.castShadow = true; hair.frustumCulled = false;
    headM.parent.add(hair);
    for (const s of ['Right', 'Left']) {
      add(G['sleeve' + s], M.shirt); add(G['uarm' + s], M.skin); add(G['farm' + s], M.skin);
      add(G['shortsLeg' + s], M.shorts); add(G['thigh' + s], M.skin); add(G['shin' + s], M.skin);
      add(G['sock' + s], M.sock); add(G['shoe' + s], M.shoe); add(G['sole' + s], M.sole);
    }
    // vợt
    const rk = (this.racket = new T.Group());
    const RM = {
      grip: std({ color: '#1d1d22', roughness: 0.95 }), cap: std({ color: shirtC, roughness: 0.4 }),
      shaft: std({ color: '#c7ccd4', roughness: 0.25, metalness: 0.7 }), frame: std({ color: '#121216', roughness: 0.3, metalness: 0.4 }),
      acc: std({ color: shirtC, roughness: 0.35, metalness: 0.2 }),
      str: new T.MeshStandardMaterial({ map: stringTex(), transparent: true, side: T.DoubleSide, roughness: 0.6, depthWrite: false }),
    };
    const mesh = (g, m, y, sx, sy, sz) => { const o = new T.Mesh(g, m); o.position.y = y; if (sx) o.scale.set(sx, sy, sz); o.castShadow = true; rk.add(o); return o; };
    mesh(new T.CylinderGeometry(0.0145, 0.0135, 0.2, 14), RM.grip, -0.02);
    mesh(new T.CylinderGeometry(0.016, 0.016, 0.012, 14), RM.cap, -0.125);
    mesh(new T.CylinderGeometry(0.0043, 0.0043, 0.3, 8), RM.shaft, 0.23);
    mesh(new T.TorusGeometry(1, 0.05, 8, 48), RM.frame, 0.47, 0.098, 0.124, 0.1);
    mesh(new T.TorusGeometry(1, 0.03, 6, 48), RM.acc, 0.47, 0.1, 0.126, 0.06);
    mesh(new T.CircleGeometry(1, 36), RM.str, 0.47, 0.094, 0.12, 1);
    this.group.add(rk);

    // ---- dữ liệu tư thế gốc để điều khiển xương ----
    this.group.updateMatrixWorld(true);
    const Wp = (n) => b[n].getWorldPosition(new T.Vector3());
    const R0 = Wp('RightUpLeg').sub(Wp('LeftUpLeg')).setZ(0).normalize();
    const F0 = new T.Vector3().crossVectors(Z, R0).normalize();
    this.ctl = [];
    const reg = (name, child, refKind) => {
      const bone = b[name], ch = b[child];
      const dir = ch.getWorldPosition(new T.Vector3()).sub(bone.getWorldPosition(new T.Vector3())).normalize();
      let ref;
      if (refKind === 'fwd') ref = orth(dir, F0);
      else if (refKind === 'palm') ref = this.palmRest(name, dir);
      else ref = orth(dir, R0);
      const qF = basisQ(dir, ref);
      const qW = bone.getWorldQuaternion(new T.Quaternion());
      const off = qF.clone().invert().multiply(qW);
      this.ctl.push({ name, bone, off });
      this['c_' + name] = this.ctl[this.ctl.length - 1];
    };
    this.palmRest = (name, dir) => {
      const s = name.startsWith('Right') ? 'Right' : 'Left';
      const across = Wp(s + 'HandIndex1').sub(Wp(s + 'HandPinky1')).normalize();
      let n = new T.Vector3().crossVectors(dir, across).normalize();
      const th = Wp(s + 'HandThumb2').sub(Wp(name));
      if (th.dot(n) < 0) n.negate();
      return orth(dir, n);
    };
    ['Hips:Spine', 'Spine:Spine1', 'Spine1:Spine2', 'Spine2:Neck', 'Neck:Head', 'Head:HeadTop_End'].forEach((p) => { const [a, c] = p.split(':'); reg(a, c, 'side'); });
    for (const s of ['Right', 'Left']) {
      reg(s + 'Arm', s + 'ForeArm', 'fwd'); reg(s + 'ForeArm', s + 'Hand', 'fwd'); reg(s + 'Hand', s + 'HandMiddle1', 'palm');
      reg(s + 'UpLeg', s + 'Leg', 'fwd'); reg(s + 'Leg', s + 'Foot', 'fwd'); reg(s + 'Foot', s + 'ToeBase', 'side');
    }
    // ngón tay: trục gập = ngang khớp đốt (từ ngón út sang ngón trỏ), chiều gập về phía lòng bàn tay
    this.fingers = [];
    for (const s of ['Right', 'Left']) {
      const hand = b[s + 'Hand'];
      const across = Wp(s + 'HandIndex1').sub(Wp(s + 'HandPinky1')).normalize();
      const dir = Wp(s + 'HandMiddle1').sub(Wp(s + 'Hand')).normalize();
      const palm = this.palmRest(s + 'Hand', dir);
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) {
        for (let k = 1; k <= 3; k++) {
          const bn = b[s + 'Hand' + f + k], ch = b[s + 'Hand' + f + (k + 1)];
          if (!bn || !ch) continue;
          const fd = ch.getWorldPosition(new T.Vector3()).sub(bn.getWorldPosition(new T.Vector3())).normalize();
          let ax = f === 'Thumb' ? new T.Vector3().crossVectors(fd, palm).normalize() : across.clone();
          // chọn chiều quay sao cho đầu ngón tiến về phía lòng bàn tay
          const moved = new T.Vector3().crossVectors(ax, fd);
          if (moved.dot(palm) < 0) ax.negate();
          const qW = bn.getWorldQuaternion(new T.Quaternion());
          const axL = ax.clone().applyQuaternion(qW.clone().invert());
          this.fingers.push({ bone: bn, rest: bn.quaternion.clone(), axL, side: s, f, k });
        }
      }
    }
    this.restLocal = {};
    for (const n in b) this.restLocal[n] = b[n].quaternion.clone();
    this.order = [];
    this.root.traverse((o) => { if (o.isBone) this.order.push(o); });
  }

  const _m = new T.Matrix4(), _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3();
  function basisQ(dir, ref) {
    _y.copy(dir).normalize();
    _x.copy(ref).addScaledVector(_y, -ref.dot(_y)).normalize();
    _z.crossVectors(_x, _y);
    _m.makeBasis(_x, _y, _z);
    return new T.Quaternion().setFromRotationMatrix(_m);
  }
  const qTmp = new T.Quaternion(), qPar = new T.Quaternion();
  Person.prototype.aim = function (name, dir, ref) {
    const c = this['c_' + name];
    const bone = c.bone;
    const qW = basisQ(dir, ref).multiply(c.off);
    bone.parent.getWorldQuaternion(qPar);
    bone.quaternion.copy(qPar.invert().multiply(qW));
    bone.updateMatrixWorld(true);
  };

  const v = (a) => new T.Vector3(a[0], a[1], a[2]);
  const sub = (a, b) => new T.Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function bendFwd(a, b, fallback, flip) {
    const n = b.clone().addScaledVector(a, -b.dot(a));
    if (n.length() < 0.12) return orth(a, fallback);
    n.normalize();
    return flip ? n.negate() : n;
  }

  Person.prototype.update = function (P, extra) {
    const b = this.bones;
    // về tư thế gốc rồi đặt hông
    for (const o of this.order) o.quaternion.copy(this.restLocal[o.name]);
    const hipsW = v(P.pelvis);
    b.Hips.parent.updateMatrixWorld(true);
    b.Hips.position.copy(b.Hips.parent.worldToLocal(hipsW.clone()));
    b.Hips.parent.updateMatrixWorld(true);
    const R = v(P.hipRw), Rc = v(P.chestR);
    const spine = sub(P.chest, P.pelvis).normalize();
    this.aim('Hips', spine, R);
    this.aim('Spine', spine, R.clone().lerp(Rc, 0.33));
    this.aim('Spine1', spine, R.clone().lerp(Rc, 0.66));
    this.aim('Spine2', spine, Rc);
    this.aim('Neck', sub(P.head, P.neck).normalize(), Rc);
    const look = v(P.look);
    const hr = new T.Vector3().crossVectors(look, Z); if (hr.length() < 0.1) hr.copy(Rc); hr.normalize();
    const hup = new T.Vector3().crossVectors(hr, look).normalize();
    this.aim('Head', hup.lerp(Z, 0.35).normalize(), hr);
    // tay: hướng gập khuỷu = phía trước cánh tay
    const chestF = v(P.chestF);
    for (const s of ['Right', 'Left']) {
      const k = s === 'Right' ? 'r' : 'l';
      const ua = sub(P[k + 'Elb'], P[k + 'Sh']).normalize(), fa = sub(P[k + 'Hand'], P[k + 'Elb']).normalize();
      const fw = bendFwd(ua, fa, chestF, false);
      this.aim(s + 'Arm', ua, fw);
      this.aim(s + 'ForeArm', fa, fw);
      if (s === 'Right') {
        // nắm kiểu bắt tay: lòng bàn tay song song mặt vợt, cổ tay hơi bẻ theo cán
        const rd = v(P.racket.dir);
        const hd = fa.clone().multiplyScalar(0.62).addScaledVector(rd, 0.38).normalize();
        this.aim('RightHand', hd, v(P.racket.normal));
      } else {
        const palm = extra && extra.holding ? new T.Vector3(0, 0, -1) : R.clone();
        this.aim('LeftHand', fa, palm);
      }
    }
    // chân: đầu gối hướng ra trước
    const hipF = v(P.hipF);
    for (const s of ['Right', 'Left']) {
      const k = s === 'Right' ? 'R' : 'L';
      const th = sub(P['knee' + k], P['hip' + k]).normalize(), sh = sub(P['ank' + k], P['knee' + k]).normalize();
      const fw = bendFwd(th, sh, hipF, true);
      this.aim(s + 'UpLeg', th, fw);
      this.aim(s + 'Leg', sh, fw);
      const fd = sub(P['toe' + k], P['ank' + k]);
      this.aim(s + 'Foot', fd.normalize(), v(P.hipRw));
    }
    // ngón tay: tay phải nắm chặt cán, tay trái thả lỏng / cầm cầu
    const holding = extra && extra.holding;
    for (const f of this.fingers) {
      let a;
      if (f.side === 'Right') a = f.f === 'Thumb' ? [0, 0.35, 0.45, 0.3][f.k] : f.f === 'Index' ? [0, 0.7, 1.15, 0.6][f.k] : [0, 1.0, 1.3, 0.7][f.k];
      else if (holding) a = f.f === 'Thumb' ? [0, 0.2, 0.4, 0.3][f.k] : f.f === 'Index' ? [0, 0.5, 0.7, 0.4][f.k] : [0, 0.9, 1.1, 0.6][f.k];
      else a = f.f === 'Thumb' ? [0, 0.1, 0.2, 0.1][f.k] : [0, 0.3, 0.45, 0.3][f.k];
      f.bone.quaternion.copy(f.rest).multiply(qTmp.setFromAxisAngle(f.axL, a));
    }
    this.root.updateMatrixWorld(true);
    // vợt: cán nằm trong lòng bàn tay
    const hand = b.RightHand;
    const hp = hand.getWorldPosition(new T.Vector3());
    const mid = b.RightHandMiddle1.getWorldPosition(new T.Vector3());
    const palmN = v(P.racket.normal);
    const rdir = v(P.racket.dir);
    const go = window.__grip || [0.72, 0.022, 0];
    const grip = hp.clone().lerp(mid, go[0]).addScaledVector(palmN, go[1]).add(new T.Vector3().crossVectors(rdir, palmN).multiplyScalar(go[2]));
    this.racket.position.copy(grip);
    this.racket.quaternion.copy(basisQ(rdir, new T.Vector3().crossVectors(rdir, palmN)));
    this.handGrip = grip;
  };

  Person.prototype.setVisible = function (x) { this.group.visible = x; };
  Rig.Person = function (kit) { return TPL ? new Person(kit) : null; };
})();
