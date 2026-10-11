// Người 3D (Three.js): khối cơ thể dựng bằng mặt tròn xoay (lathe) theo hình dáng cơ thật —
// vai, bắp tay, cẳng tay, đùi, bắp chân — mặc áo thi đấu, quần short, tất, giày; đầu có mặt, tai, tóc, băng đô;
// vợt thật (cán, thân, khung oval, lưới đan). Mỗi khung hình đặt theo khớp từ BL.Anim.pose().
(function () {
  const BL = window.BL;
  const T = window.THREE;
  if (!T) return;
  T.ColorManagement.legacyMode = false; // màu hex hiểu là sRGB -> màu da/áo đúng, không nhợt

  const Y = new T.Vector3(0, 1, 0);
  const tmpM = new T.Matrix4();
  const vA = new T.Vector3(), vB = new T.Vector3(), vX = new T.Vector3(), vY = new T.Vector3(), vZ = new T.Vector3();

  // mặt tròn xoay dọc trục Y dài 1, prof = [[t, r], ...]
  function lathe(prof, seg) {
    const pts = prof.map(([t, r]) => new T.Vector2(Math.max(0.0005, r), t));
    const g = new T.LatheGeometry(pts, seg || 18);
    g.computeVertexNormals();
    return g;
  }
  // bo kín 2 đầu cho khúc chi
  const capped = (prof) => [[prof[0][0] - 0.0001, 0.0005], ...prof, [prof[prof.length - 1][0] + 0.0001, 0.0005]];

  const GEO = {};
  function geos() {
    if (GEO.ok) return GEO;
    // tỉ lệ dài tương đối dọc khúc, bán kính (m)
    GEO.thigh = lathe(capped([[0, 0.078], [0.1, 0.086], [0.35, 0.08], [0.7, 0.064], [0.92, 0.052], [1, 0.05]]));
    GEO.shorts = lathe([[-0.05, 0.1], [0.15, 0.098], [0.45, 0.092], [0.6, 0.09]]);
    GEO.shin = lathe(capped([[0, 0.05], [0.12, 0.054], [0.3, 0.06], [0.5, 0.05], [0.8, 0.036], [1, 0.032]]));
    GEO.sock = lathe([[0, 0.036], [0.6, 0.04], [1, 0.044]]);
    GEO.uarm = lathe(capped([[0, 0.05], [0.15, 0.054], [0.4, 0.05], [0.75, 0.042], [1, 0.037]]));
    GEO.sleeve = lathe([[-0.1, 0.064], [0.2, 0.062], [0.45, 0.056]]);
    GEO.farm = lathe(capped([[0, 0.038], [0.2, 0.043], [0.5, 0.037], [0.85, 0.028], [1, 0.026]]));
    // thân: hông -> eo -> ngực -> vai (cắt ngang hình elip nhờ scale)
    GEO.torso = lathe(capped([[0, 0.13], [0.18, 0.125], [0.38, 0.135], [0.6, 0.158], [0.8, 0.17], [0.92, 0.15], [1.0, 0.075]]), 24);
    GEO.pelvis = new T.SphereGeometry(0.1, 20, 14);
    GEO.joint = new T.SphereGeometry(1, 14, 10);
    GEO.neck = lathe([[0, 0.05], [1, 0.044]]);
    GEO.skull = new T.SphereGeometry(0.1, 26, 20);
    GEO.hair = new T.SphereGeometry(0.106, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.56);
    GEO.ear = new T.SphereGeometry(0.022, 10, 8);
    GEO.nose = new T.ConeGeometry(0.014, 0.035, 8);
    GEO.eye = new T.SphereGeometry(0.0105, 10, 8);
    GEO.band = new T.TorusGeometry(0.1, 0.012, 8, 28);
    GEO.collar = new T.TorusGeometry(0.058, 0.012, 8, 20);
    GEO.hand = new T.SphereGeometry(1, 12, 10);
    GEO.soleBox = new T.BoxGeometry(0.1, 0.28, 0.024);
    // vợt
    GEO.grip = new T.CylinderGeometry(0.015, 0.0135, 0.2, 12);
    GEO.shaft = new T.CylinderGeometry(0.0045, 0.0045, 1, 8);
    GEO.frame = new T.TorusGeometry(1, 0.055, 8, 40);
    GEO.strings = new T.CircleGeometry(1, 32);
    GEO.ok = true;
    return GEO;
  }

  // vân lưới đan cho mặt vợt
  let STRING_TEX = null;
  function stringTex() {
    if (STRING_TEX) return STRING_TEX;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(245,245,240,0.95)';
    x.lineWidth = 1.2;
    for (let i = 0; i <= 128; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    STRING_TEX = new T.CanvasTexture(c);
    return STRING_TEX;
  }

  const std = (color, rough, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: rough === undefined ? 0.7 : rough, metalness: 0 }, extra || {}));

  function Human3D(kit) {
    geos();
    const g = (this.group = new T.Group());
    const shirt = new T.Color(kit.color || '#d33');
    const M = (this.mat = {
      skin: std(kit.skin || '#e0aa82', 0.55),
      shirt: std(shirt, 0.82),
      trim: std('#ffffff', 0.7),
      shorts: std(kit.shorts || '#1b1d28', 0.85),
      sock: std('#f4f4f2', 0.9),
      shoe: std('#f7f7f5', 0.5),
      shoeAcc: std(shirt.clone().offsetHSL(0, 0, -0.05), 0.5),
      sole: std('#d8d2c8', 0.8),
      hair: std(kit.hair || '#1a120c', 0.9),
      eye: std('#15100c', 0.3),
      grip: std('#222', 0.9),
      shaft: std('#c9ced8', 0.3, { metalness: 0.6 }),
      frame: std('#141418', 0.35, { metalness: 0.3 }),
      frameAcc: std(shirt, 0.4),
      strings: new T.MeshStandardMaterial({ map: stringTex(), transparent: true, opacity: 0.85, side: T.DoubleSide, roughness: 0.6, depthWrite: false }),
    });
    const mk = (geo, mat, name) => { const m = new T.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = false; g.add(m); if (name) this[name] = m; return m; };
    // chi
    for (const s of ['R', 'L']) {
      mk(GEO.thigh, M.skin, 'thigh' + s);
      mk(GEO.shorts, M.shorts, 'short' + s);
      mk(GEO.shin, M.skin, 'shin' + s);
      mk(GEO.sock, M.sock, 'sock' + s);
      mk(GEO.joint, M.skin, 'knee' + s).scale.setScalar(0.052);
      const shoe = new T.Group(); g.add(shoe); this['shoe' + s] = shoe;
      // giày: thân giày (elip) + đế + sọc màu; trục Y = mũi giày, Z = lên
      const up = new T.Mesh(GEO.hand, M.shoe); up.scale.set(0.05, 0.135, 0.048); up.position.set(0, 0.0, 0.04); up.castShadow = true; shoe.add(up);
      const sole = new T.Mesh(GEO.soleBox, M.sole); sole.position.set(0, 0.0, 0.012); sole.castShadow = true; shoe.add(sole);
      const stripe = new T.Mesh(GEO.hand, M.shoeAcc); stripe.scale.set(0.052, 0.07, 0.03); stripe.position.set(0, -0.01, 0.035); shoe.add(stripe);
      mk(GEO.uarm, M.skin, 'uarm' + s);
      mk(GEO.sleeve, M.shirt, 'sleeve' + s);
      mk(GEO.farm, M.skin, 'farm' + s);
      mk(GEO.joint, M.skin, 'elb' + s).scale.setScalar(0.04);
      mk(GEO.joint, M.shirt, 'delt' + s).scale.setScalar(0.064);
      mk(GEO.hand, M.skin, 'hand' + s).scale.set(0.038, 0.05, 0.026);
    }
    // thân
    mk(GEO.torso, M.shirt, 'torso');
    mk(GEO.pelvis, M.shorts, 'pelvisM');
    mk(GEO.neck, M.skin, 'neckM');
    mk(GEO.collar, M.trim, 'collarM');
    // đầu
    const head = (this.head = new T.Group()); g.add(head);
    const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; head.add(m); return m; };
    add(GEO.skull, M.skin, 0, 0, 0, 0.9, 1.0, 1.1);
    add(GEO.skull, M.skin, 0, 0.035, -0.06, 0.62, 0.6, 0.5); // cằm/hàm
    // tóc: chỏm cầu quay lên đỉnh và ngả ra sau, phủ đỉnh + gáy, chừa trán & mặt
    const hair = add(GEO.hair, M.hair, 0, -0.006, 0.012, 0.93, 1.05, 1.1); hair.rotation.set(Math.PI / 2 + 0.38, 0, 0);
    add(GEO.ear, M.skin, 0.088, -0.005, -0.005, 0.5, 1, 1.2);
    add(GEO.ear, M.skin, -0.088, -0.005, -0.005, 0.5, 1, 1.2);
    const nose = add(GEO.nose, M.skin, 0, 0.098, -0.012); nose.quaternion.setFromUnitVectors(Y, new T.Vector3(0, 1, -0.35).normalize());
    add(GEO.eye, M.eye, 0.034, 0.088, 0.012);
    add(GEO.eye, M.eye, -0.034, 0.088, 0.012);
    add(GEO.band, M.shirt, 0, -0.004, 0.045, 0.93, 1.04, 1.4);
    // vợt
    const rk = (this.racket = new T.Group()); g.add(rk);
    const grip = new T.Mesh(GEO.grip, M.grip); grip.position.y = -0.03; rk.add(grip);
    const shaft = new T.Mesh(GEO.shaft, M.shaft); shaft.scale.y = 0.32; shaft.position.y = 0.23; rk.add(shaft);
    const fr = new T.Mesh(GEO.frame, M.frame); fr.scale.set(0.1, 0.125, 0.1); fr.position.y = 0.52; rk.add(fr);
    const fa = new T.Mesh(GEO.frame, M.frameAcc); fa.scale.set(0.1, 0.125, 0.06); fa.position.y = 0.52; fa.position.z = 0.0004; rk.add(fa);
    const st = new T.Mesh(GEO.strings, M.strings); st.scale.set(0.096, 0.12, 1); st.position.y = 0.52; rk.add(st);
    rk.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  // đặt khúc chi từ a tới b, trục X quay theo ref
  function seg(m, a, b, ref, r0, r1) {
    vA.set(a[0], a[1], a[2]); vB.set(b[0], b[1], b[2]);
    vY.subVectors(vB, vA);
    let len = vY.length();
    if (len < 1e-4) { vY.set(0, 0, 1); len = 1e-4; } else vY.multiplyScalar(1 / len);
    vX.set(ref[0], ref[1], ref[2]);
    vX.addScaledVector(vY, -vX.dot(vY));
    if (vX.lengthSq() < 1e-6) { vX.set(1, 0, 0).addScaledVector(vY, -vY.x); }
    vX.normalize();
    vZ.crossVectors(vX, vY);
    tmpM.makeBasis(vX, vY, vZ);
    m.quaternion.setFromRotationMatrix(tmpM);
    m.position.copy(vA);
    if (r0 !== undefined) m.position.addScaledVector(vY, r0 * len);
    m.scale.set(1, (r1 !== undefined ? r1 - (r0 || 0) : 1) * len, 1);
  }
  // nhóm có trục Y = fwd, Z = up
  function frame(m, pos, fwd, up) {
    vY.set(fwd[0], fwd[1], fwd[2]).normalize();
    vZ.set(up[0], up[1], up[2]);
    vZ.addScaledVector(vY, -vZ.dot(vY)).normalize();
    vX.crossVectors(vY, vZ);
    tmpM.makeBasis(vX, vY, vZ);
    m.quaternion.setFromRotationMatrix(tmpM);
    m.position.set(pos[0], pos[1], pos[2]);
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  Human3D.prototype.update = function (P) {
    const up = [0, 0, 1];
    for (const s of ['R', 'L']) {
      const hip = P['hip' + s], knee = P['knee' + s], ank = P['ank' + s], toe = P['toe' + s];
      const sh = P[(s === 'R' ? 'r' : 'l') + 'Sh'], el = P[(s === 'R' ? 'r' : 'l') + 'Elb'], hd = P[(s === 'R' ? 'r' : 'l') + 'Hand'];
      const out = s === 'R' ? P.hipRw : [-P.hipRw[0], -P.hipRw[1], -P.hipRw[2]];
      seg(this['thigh' + s], hip, knee, out);
      seg(this['short' + s], hip, knee, out);
      seg(this['shin' + s], knee, ank, out);
      seg(this['sock' + s], ank, knee, out, 0.0, 0.32);
      this['knee' + s].position.set(knee[0], knee[1], knee[2]);
      // giày: hướng gót -> mũi
      const fwd = sub(toe, ank);
      frame(this['shoe' + s], [ank[0] + fwd[0] * 0.3, ank[1] + fwd[1] * 0.3, Math.max(P.base[2], ank[2] - 0.07)], fwd, up);
      const shOut = s === 'R' ? P.chestR : [-P.chestR[0], -P.chestR[1], -P.chestR[2]];
      seg(this['uarm' + s], sh, el, shOut);
      seg(this['sleeve' + s], sh, el, shOut);
      seg(this['farm' + s], el, hd, shOut);
      this['elb' + s].position.set(el[0], el[1], el[2]);
      this['delt' + s].position.set(sh[0], sh[1], sh[2]);
    }
    // bàn tay phải nắm cán vợt, tay trái theo cẳng tay
    const rk = P.racket;
    frame(this.handR, rk.hand, rk.dir, rk.normal);
    const lfw = sub(P.lHand, P.lElb);
    frame(this.handL, lerp3(P.lHand, P.lElb, -0.15), lfw, P.chestF);
    // thân & hông
    seg(this.torso, P.pelvis, P.neck, P.chestR, -0.02, 1.02);
    this.torso.scale.x = 1.12; this.torso.scale.z = 0.72;
    frame(this.pelvisM, lerp3(P.pelvis, P.chest, 0.08), P.hipF, sub(P.chest, P.pelvis));
    this.pelvisM.scale.set(1.62, 1.18, 1.45);
    seg(this.neckM, P.neck, P.head, P.chestR, 0, 0.55);
    frame(this.collarM, P.neck, P.chestF, sub(P.head, P.neck));
    this.collarM.scale.set(1, 1, 1);
    // đầu nhìn theo cầu
    frame(this.head, P.head, P.look, [0, 0, 1]);
    // vợt: trục Y = cán, Z = pháp tuyến mặt vợt
    frame(this.racket, rk.hand, rk.dir, rk.normal);
  };

  Human3D.prototype.setVisible = function (v) { this.group.visible = v; };
  BL.Human3D = Human3D;
})();
