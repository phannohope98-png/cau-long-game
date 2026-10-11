// Đồ hoạ 3D (Three.js/WebGL): nhà thi đấu, sàn gỗ, thảm sân BWF, vạch kẻ, lưới mắt cáo, cột,
// đèn trần + bóng đổ mềm, khán đài, người 3D, vợt, quả cầu lông vũ (lật đầu khi bị đánh, xoáy khi bỏ nhỏ),
// vệt bay, vòng điểm rơi, camera phối cảnh chéo sau lưng, tua lại Mắt diều hâu.
(function () {
  const BL = window.BL;
  const T = window.THREE;
  const C = BL.C;
  const R3 = (BL.Render3D = { ok: false });
  if (!T) return;

  let renderer, scene, camera, cv, ov, octx, W = 0, H = 0;
  let humans = [], humanKits = ['', ''];
  let shuttle, shShadow, trail, marker, markerDot, sun;
  const fx = { pops: [], bursts: [] };
  let camX = 0, camK = 0, shake = 0;
  const shQ = new T.Quaternion(), tgtQ = new T.Quaternion();
  let lastShot = null, tumbleT = 0, lastHitT = -1;
  const UPV = new T.Vector3(0, 1, 0);

  // ---------- kết cấu vẽ bằng canvas ----------
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  const rnd = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  function woodTex() {
    return canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#b07a46'; x.fillRect(0, 0, w, h);
      const pw = 64;
      for (let i = 0; i < w / pw; i++) {
        for (let j = 0; j < 4; j++) {
          const y0 = j * 128 + (i % 2) * 64, len = 128;
          const tone = 0.85 + rnd() * 0.3;
          x.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(120 * tone)},${Math.round(70 * tone)})`;
          x.fillRect(i * pw, y0, pw - 1, len - 1);
          x.strokeStyle = 'rgba(70,40,15,0.18)';
          for (let k = 0; k < 6; k++) { x.beginPath(); const xx = i * pw + rnd() * pw; x.moveTo(xx, y0); x.bezierCurveTo(xx + 4, y0 + 40, xx - 4, y0 + 80, xx + 2, y0 + len); x.stroke(); }
        }
      }
      x.fillStyle = 'rgba(60,30,10,0.35)';
      for (let i = 0; i <= w; i += pw) x.fillRect(i - 1, 0, 1, h);
    }, [20, 20]);
  }
  function matTex() {
    return canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#14684a'; x.fillRect(0, 0, w, h);
      const id = x.getImageData(0, 0, w, h);
      for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 14; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
      x.putImageData(id, 0, 0);
    }, [6, 12]);
  }
  function netTex() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 512, 64);
    x.strokeStyle = 'rgba(15,15,15,0.95)'; x.lineWidth = 1.6;
    for (let i = 0; i <= 512; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); }
    for (let j = 0; j <= 64; j += 8) { x.beginPath(); x.moveTo(0, j); x.lineTo(512, j); x.stroke(); }
    const t = new T.CanvasTexture(c);
    t.wrapS = T.RepeatWrapping; t.wrapT = T.RepeatWrapping; t.repeat.set(4, 1.2);
    return t;
  }
  function featherTex() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 64);
    for (let i = 0; i < 16; i++) {
      const cx = (i + 0.5) * 16;
      x.fillStyle = 'rgba(252,252,248,0.97)';
      x.beginPath(); x.moveTo(cx - 1, 64); x.quadraticCurveTo(cx - 8, 20, cx, 2); x.quadraticCurveTo(cx + 8, 20, cx + 1, 64); x.fill();
      x.strokeStyle = 'rgba(150,150,140,0.9)'; x.lineWidth = 1;
      x.beginPath(); x.moveTo(cx, 64); x.lineTo(cx, 4); x.stroke();
    }
    x.fillStyle = 'rgba(30,60,160,0.9)'; x.fillRect(0, 44, 256, 3); x.fillStyle = 'rgba(200,30,40,0.9)'; x.fillRect(0, 49, 256, 2);
    return new T.CanvasTexture(c);
  }
  function adTex(text, bg) {
    return canvasTex(512, 96, (x, w, h) => {
      x.fillStyle = bg; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, 0, w, h * 0.45);
      x.fillStyle = '#fff'; x.font = '900 52px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(text, w / 2, h / 2 + 2);
    });
  }

  const std = (color, rough, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: rough === undefined ? 0.7 : rough }, extra || {}));
  function box(w, d, h, mat, x, y, z, parent) {
    const m = new T.Mesh(new T.BoxGeometry(w, d, h), mat);
    m.position.set(x, y, z);
    (parent || scene).add(m);
    return m;
  }

  // ---------- dựng cảnh ----------
  function buildArena() {
    scene.background = new T.Color('#0d1222');
    scene.fog = new T.Fog('#0d1222', 30, 60);
    // ánh sáng: đèn trần mạnh từ trên + đèn bán cầu (trần sáng, sàn ấm) + đèn phụ không đổ bóng
    const hemi = new T.HemisphereLight('#dfe6ff', '#3a2e22', 0.22);
    hemi.position.set(0, 0, 1);
    scene.add(hemi);
    sun = new T.DirectionalLight('#fff3e0', 1.0);
    sun.position.set(2.5, -5, 16);
    sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -8; sc.right = 8; sc.top = 10; sc.bottom = -10; sc.near = 4; sc.far = 30;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    scene.add(sun); scene.add(sun.target);
    // đèn rọi sân: vùng sân sáng rực, xung quanh tối dần như nhà thi đấu thật
    for (const yy of [-4, 4]) {
      const sp = new T.SpotLight('#fff6e6', 2.2, 34, 0.62, 0.7, 1.2);
      sp.position.set(0, yy * 0.6, 15); sp.target.position.set(0, yy, 0);
      scene.add(sp); scene.add(sp.target);
    }
    const fill = new T.DirectionalLight('#c9d8ff', 0.2);
    fill.position.set(-6, 8, 9);
    scene.add(fill);

    // sàn gỗ
    const wood = std('#ffffff', 0.26, { map: woodTex(), envMapIntensity: 1.2 });
    const floor = new T.Mesh(new T.PlaneGeometry(36, 44), wood);
    floor.receiveShadow = true;
    scene.add(floor);
    // thảm sân (thảm PU xanh BWF), rộng hơn sân 1.5 m
    const mat = std('#ffffff', 0.62, { map: matTex() });
    const mt = new T.Mesh(new T.PlaneGeometry(C.HALF_W_D * 2 + 3, C.HALF_L * 2 + 4.4), mat);
    mt.position.z = 0.004; mt.receiveShadow = true;
    scene.add(mt);
    // mép thảm
    const edge = std('#14563c', 0.8);
    for (const s of [-1, 1]) {
      box(0.05, C.HALF_L * 2 + 4.4, 0.012, edge, s * (C.HALF_W_D + 1.5), 0, 0.004);
      box(C.HALF_W_D * 2 + 3, 0.05, 0.012, edge, 0, s * (C.HALF_L + 2.2), 0.004);
    }
    // vạch kẻ trắng 4 cm (mép ngoài đúng kích thước chuẩn)
    const lineM = std('#f6f8f4', 0.5);
    const lw = C.LINE_W, z = 0.0085;
    const L = C.HALF_L, Wd = C.HALF_W_D, Ws = C.HALF_W_S;
    const ln = (x0, y0, x1, y1) => { const m = box(Math.abs(x1 - x0), Math.abs(y1 - y0), 0.002, lineM, (x0 + x1) / 2, (y0 + y1) / 2, z); m.receiveShadow = true; };
    for (const s of [-1, 1]) {
      ln(s * Wd - s * lw, -L, s * Wd, L);
      ln(s * Ws - s * lw, -L, s * Ws, L);
      ln(-Wd, s * L - s * lw, Wd, s * L);
      ln(-Wd, s * (L - C.LONG_SVC_D), Wd, s * (L - C.LONG_SVC_D) + s * lw);
      ln(-Wd, s * C.SHORT_SVC, Wd, s * (C.SHORT_SVC + lw));
      ln(-lw / 2, s * C.SHORT_SVC, lw / 2, s * L);
    }

    // cột lưới + chân đế
    const postM = std('#14402c', 0.5, { metalness: 0.4 });
    for (const s of [-1, 1]) {
      const p = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, C.NET_H_P, 12), postM);
      p.rotation.x = Math.PI / 2; p.position.set(s * (Wd + 0.02), 0, C.NET_H_P / 2); p.castShadow = true; scene.add(p);
      const b = box(0.36, 0.5, 0.06, postM, s * (Wd + 0.2), 0, 0.03); b.castShadow = true;
    }
    // lưới mắt cáo: mép trên võng theo chiều cao thật (1.55 ở cột, 1.524 giữa sân)
    const ng = new T.PlaneGeometry(Wd * 2, 0.76, 40, 1);
    const pos = ng.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), yy = pos.getY(i);
      const top = BL.netHeight(x);
      pos.setXYZ(i, x, 0, yy > 0 ? top : top - 0.76);
    }
    ng.computeVertexNormals();
    const net = new T.Mesh(ng, new T.MeshStandardMaterial({ map: netTex(), transparent: true, side: T.DoubleSide, roughness: 0.9, alphaTest: 0.2, depthWrite: false, color: '#222' }));
    net.castShadow = true;
    scene.add(net);
    // băng trắng mép lưới
    const tg = new T.PlaneGeometry(Wd * 2, 0.075, 40, 1);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), yy = tp.getY(i); tp.setXYZ(i, x, 0, BL.netHeight(x) + (yy > 0 ? 0.004 : -0.071)); }
    tg.computeVertexNormals();
    scene.add(new T.Mesh(tg, std('#f4f4ef', 0.6, { side: T.DoubleSide })));

    // ghế trọng tài
    const chairM = std('#2c3240', 0.6, { metalness: 0.3 });
    box(0.06, 0.06, 1.9, chairM, -Wd - 1.1, -0.3, 0.95); box(0.06, 0.06, 1.9, chairM, -Wd - 1.1, 0.3, 0.95);
    box(0.06, 0.06, 1.9, chairM, -Wd - 1.6, -0.3, 0.95); box(0.06, 0.06, 1.9, chairM, -Wd - 1.6, 0.3, 0.95);
    box(0.6, 0.7, 0.06, chairM, -Wd - 1.35, 0, 1.9);
    box(0.06, 0.7, 0.6, chairM, -Wd - 1.65, 0, 2.2);

    // bảng quảng cáo LED đứng quanh sân, mặt quay vào sân
    const ads = [['CẦU LÔNG VIỆT', '#c62f3a'], ['SMASH 400', '#1f6fd1'], ['LÔNG VŨ PRO', '#e3a21a'], ['VỢT XỊN', '#18915b'], ['MẮT DIỀU HÂU', '#7a3fc9'], ['BWF CHUẨN', '#0f8aa8']];
    let i = 0;
    const adGeo = new T.PlaneGeometry(3.3, 0.8);
    const board = (x, y, lx, ly) => {
      const [t, c] = ads[i++ % ads.length];
      const m = new T.Mesh(adGeo, new T.MeshStandardMaterial({ map: adTex(t, c), roughness: 0.4, emissive: '#ffffff', emissiveMap: adTex(t, c), emissiveIntensity: 0.35 }));
      m.position.set(x, y, 0.42);
      m.up.set(0, 0, 1);
      m.lookAt(lx, ly, 0.42);
      scene.add(m);
      const back = box(3.3, 0.08, 0.84, std('#111', 0.8), x, y, 0.42); back.up.set(0, 0, 1); back.lookAt(lx, ly, 0.42); back.translateZ(-0.05);
    };
    for (let x = -8.5; x <= 8.5; x += 3.4) board(x, C.HALF_L + 3.2, x, 0);
    for (let x = -8.5; x <= 8.5; x += 3.4) board(x, -C.HALF_L - 3.4, x, 0);
    for (const s of [-1, 1]) for (let y = -8.5; y <= 8.5; y += 3.4) board(s * (Wd + 3.1), y, 0, y);
    // khán đài bậc thang + khán giả (instanced)
    const standM = new T.MeshLambertMaterial({ color: '#080b14' });
    const crowdG = new T.CapsuleGeometry(0.15, 0.3, 3, 8);
    const crowdM = new T.MeshLambertMaterial({ color: '#ffffff' });
    const headG = new T.SphereGeometry(0.1, 10, 8);
    const headM = new T.MeshLambertMaterial({ color: '#ffffff' });
    const seats = [];
    const tiers = (axis, s, start, len) => {
      for (let r = 0; r < 9; r++) {
        const d = start + r * 0.85, h = 0.6 + r * 0.55;
        const b = axis === 'y' ? box(len, 0.85, h, standM, 0, s * (d + 0.42), h / 2) : box(0.85, len, h, standM, s * (d + 0.42), 0, h / 2);
        b.receiveShadow = true;
        for (let k = -len / 2 + 0.35; k < len / 2; k += 0.62) {
          if (rnd() < 0.18) continue;
          seats.push(axis === 'y' ? [k + (rnd() - 0.5) * 0.1, s * (d + 0.45), h + 0.32] : [s * (d + 0.45), k + (rnd() - 0.5) * 0.1, h + 0.32]);
        }
      }
    };
    tiers('y', 1, C.HALF_L + 4.6, 22);
    tiers('x', 1, Wd + 4.3, 26);
    tiers('x', -1, Wd + 4.3, 26);
    const crowd = new T.InstancedMesh(crowdG, crowdM, seats.length);
    const mm = new T.Matrix4(), q = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI / 2), col = new T.Color();
    const shirts = ['#d33a3a', '#2f6fd8', '#f2c23a', '#ffffff', '#2fa86a', '#1d1d26', '#e56fb0', '#ff8c2a', '#6b4fd6', '#9aa4b8'];
    const heads = new T.InstancedMesh(headG, headM, seats.length);
    const skins = ['#e0aa82', '#c98f66', '#f0c8a0', '#a8714a', '#d9a07a'];
    seats.forEach((p, j) => {
      // khán đài tối hơn sân (đèn chỉ rọi sân), người cao thấp khác nhau
      const sc = 0.9 + rnd() * 0.2;
      mm.compose(new T.Vector3(p[0], p[1], p[2]), q, new T.Vector3(1, 1, sc));
      crowd.setMatrixAt(j, mm);
      crowd.setColorAt(j, col.set(shirts[Math.floor(rnd() * shirts.length)]).multiplyScalar(0.07 + rnd() * 0.06));
      mm.compose(new T.Vector3(p[0], p[1], p[2] + 0.36 * sc), new T.Quaternion(), new T.Vector3(1, 1, 1.1));
      heads.setMatrixAt(j, mm);
      heads.setColorAt(j, col.set(skins[Math.floor(rnd() * skins.length)]).multiplyScalar(0.12));
    });
    scene.add(crowd); scene.add(heads);
    R3.crowd = crowd;
    // tường + đèn trần
    const wallM = std('#151b2e', 0.95);
    box(40, 0.4, 14, wallM, 0, 22, 7); box(40, 0.4, 14, wallM, 0, -22, 7);
    box(0.4, 44, 14, wallM, 18, 0, 7); box(0.4, 44, 14, wallM, -18, 0, 7);
    const lampM = new T.MeshBasicMaterial({ color: '#fffbe8' });
    for (let y = -9; y <= 9; y += 4.5) for (const x of [-4, 4]) box(1.4, 0.5, 0.08, lampM, x, y, 12.5);
  }

  // Ánh sáng môi trường: phòng tối có dàn đèn trần + bảng LED -> phản chiếu thật trên sàn gỗ bóng, da, vợt
  function buildEnv() {
    const env = new T.Scene();
    env.background = new T.Color('#0b0e18');
    const room = new T.Mesh(new T.BoxGeometry(60, 60, 30), new T.MeshBasicMaterial({ color: '#141a2b', side: T.BackSide }));
    room.position.z = 10; env.add(room);
    const lamp = new T.MeshBasicMaterial({ color: new T.Color(6, 5.8, 5.2) });
    for (let y = -9; y <= 9; y += 4.5) for (const x of [-4, 4]) { const l = new T.Mesh(new T.PlaneGeometry(1.6, 0.7), lamp); l.position.set(x, y, 12); l.rotation.x = Math.PI; env.add(l); }
    const cols = ['#c62f3a', '#1f6fd1', '#e3a21a', '#18915b', '#7a3fc9'];
    cols.forEach((c, i) => { const p = new T.Mesh(new T.PlaneGeometry(4, 1), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(1.5), side: T.DoubleSide })); p.position.set(-8 + i * 4, 10, 0.5); p.rotation.x = Math.PI / 2; env.add(p); });
    const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshBasicMaterial({ color: '#3a2a1c' })); env.add(floor);
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.035).texture;
    pm.dispose();
  }

  // quả cầu: đế bần + váy lông vũ (nón hở) + băng chỉ; trục +Y = hướng đế (đầu bay)
  function buildShuttle() {
    const g = new T.Group();
    const k = 1.5; // phóng to nhẹ cho dễ nhìn trên điện thoại
    const cork = new T.Mesh(new T.SphereGeometry(0.0135 * k, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std('#f6efe0', 0.6));
    cork.position.y = 0.0;
    g.add(cork);
    const corkBase = new T.Mesh(new T.CylinderGeometry(0.0135 * k, 0.013 * k, 0.012 * k, 16), std('#e9dcc0', 0.7));
    corkBase.position.y = -0.006 * k; g.add(corkBase);
    const skirt = new T.Mesh(new T.CylinderGeometry(0.012 * k, 0.034 * k, 0.07 * k, 24, 1, true), new T.MeshStandardMaterial({ map: featherTex(), transparent: true, side: T.DoubleSide, roughness: 0.8, alphaTest: 0.3 }));
    skirt.position.y = -0.047 * k; g.add(skirt);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function buildTrail() {
    const N = 18;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    geo.setAttribute('color', new T.BufferAttribute(new Float32Array(N * 2 * 4), 4));
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide }));
    m.frustumCulled = false;
    m.userData.N = N; m.userData.pts = [];
    return m;
  }

  R3.init = function (canvas) {
    try {
      cv = canvas;
      renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
    } catch (e) { R3.ok = false; return false; }
    if (!renderer.getContext()) return false;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(40, 1, 0.1, 120);
    camera.up.set(0, 0, 1);
    buildArena();
    buildEnv();
    // nạp người thật (mô hình có khung xương); trong lúc chờ dùng người dựng sẵn
    if (BL.HumanRig) BL.HumanRig.load((ok) => { R3.realHumans = ok; });
    shuttle = buildShuttle(); scene.add(shuttle);
    shShadow = new T.Mesh(new T.CircleGeometry(0.035, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shShadow.position.z = 0.012; scene.add(shShadow);
    trail = buildTrail(); scene.add(trail);
    marker = new T.Mesh(new T.RingGeometry(0.2, 0.25, 40), new T.MeshBasicMaterial({ color: '#ffd63c', transparent: true, opacity: 0.9, depthWrite: false }));
    marker.position.z = 0.014; scene.add(marker);
    markerDot = new T.Mesh(new T.CircleGeometry(0.04, 16), new T.MeshBasicMaterial({ color: '#ffd63c', transparent: true, depthWrite: false }));
    markerDot.position.z = 0.014; scene.add(markerDot);
    // lớp 2D cho chữ (tốc độ, tua lại)
    ov = document.createElement('canvas');
    ov.id = 'ov';
    ov.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;pointer-events:none;';
    cv.parentNode.insertBefore(ov, cv.nextSibling);
    octx = ov.getContext('2d');
    R3.ok = true;
    R3.resize();
    return true;
  };

  // ---------- camera vừa khung (giống bản 2D): cả nửa sân mình + một phần sân đối thủ ----------
  const MAIN_POS = [0, -12.6, 7.0], MAIN_TGT = [0, -0.4, 0];
  const fit = {};
  function projFit(p, pos, tgt) {
    const f = new T.Vector3(tgt[0] - pos[0], tgt[1] - pos[1], tgt[2] - pos[2]).normalize();
    const r = new T.Vector3().crossVectors(f, new T.Vector3(0, 0, 1)).normalize();
    const u = new T.Vector3().crossVectors(r, f);
    const d = new T.Vector3(p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]);
    const z = d.dot(f);
    return { x: d.dot(r) / z, y: -d.dot(u) / z };
  }
  function fitFor(farY, farZ) {
    const pts = [[-3.4, -7.3, 0], [3.4, -7.3, 0], [-3.1, farY, 0], [3.1, farY, 0], [0, 0, 1.55], [0, farY + 0.6, farZ]];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const q = projFit(p, MAIN_POS, MAIN_TGT); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const portrait = H > W;
    const fw = (W * (portrait ? 1.12 : 0.98)) / (x1 - x0), fh = (H * (portrait ? 0.7 : 0.9)) / (y1 - y0);
    const focal = Math.min(fw, fh);
    return { focal, cx: W / 2 - ((x0 + x1) / 2) * focal, cy: (portrait ? H * 0.45 : H * 0.53) - ((y0 + y1) / 2) * focal };
  }
  R3.resize = function () {
    if (!renderer) return;
    W = cv.clientWidth; H = cv.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fit.n = fitFor(2.6, 1.8); fit.d = fitFor(6.9, 2.9);
  };
  function applyCam(pos, tgt, focal, cx, cy) {
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(tgt[0], tgt[1], tgt[2]);
    camera.aspect = W / H;
    camera.fov = (2 * Math.atan(H / 2 / focal) * 180) / Math.PI;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
  }
  const pv = new T.Vector3();
  function toScreen(p) {
    pv.set(p[0], p[1], p[2]).project(camera);
    return { x: (pv.x * 0.5 + 0.5) * W, y: (-pv.y * 0.5 + 0.5) * H, z: pv.z, s: H / (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(0.1, camera.position.distanceTo(new T.Vector3(p[0], p[1], p[2]))) };
  }
  R3.proj = toScreen;

  // ---------- người ----------
  function ensureHumans(snaps) {
    const real = BL.HumanRig && BL.HumanRig.ready;
    snaps.forEach((s, i) => {
      const key = JSON.stringify(s.kit) + (real ? 'R' : 'P');
      if (!humans[i] || humanKits[i] !== key) {
        if (humans[i]) scene.remove(humans[i].group);
        humans[i] = (real && BL.HumanRig.Person(s.kit)) || new BL.Human3D(s.kit);
        humanKits[i] = key;
        scene.add(humans[i].group);
      }
    });
  }
  function updateHumans(snaps, sp, held) {
    ensureHumans(snaps);
    snaps.forEach((s, i) => {
      if (s.holding && held) s.heldPos = sp;
      s.lookAt = sp;
      humans[i].update(BL.Anim.pose(s), s);
    });
  }

  // ---------- quả cầu ----------
  function placeShuttle(sp, dir, dt, spd) {
    shuttle.position.set(sp[0], sp[1], sp[2]);
    const d = new T.Vector3(dir[0], dir[1], dir[2]);
    if (d.lengthSq() < 1e-10) d.set(0, 0, -1);
    d.normalize();
    tgtQ.setFromUnitVectors(UPV, d);
    // cầu lật đầu ngay sau khi bị đánh (đế bần quay về phía trước) — lật nhanh trong ~0.1 s
    shQ.slerp(tgtQ, Math.min(1, dt * (spd > 8 ? 30 : 14)));
    shuttle.quaternion.copy(shQ);
    // bỏ nhỏ: cầu xoáy lật lông ngay trên lưới
    if (tumbleT > 0) {
      const ax = new T.Vector3(1, 0, 0).applyQuaternion(shQ);
      const a = Math.sin(tumbleT * 22) * Math.min(1, tumbleT * 3) * 0.9;
      shuttle.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(ax, a));
    }
    shShadow.position.set(sp[0], sp[1], 0.012);
    const k = 1 + Math.max(0, sp[2]) * 0.2;
    shShadow.scale.set(k, k, 1);
    shShadow.material.opacity = BL.clamp(0.45 - sp[2] * 0.05, 0.08, 0.45);
  }
  function updateTrail(sp, spd, on) {
    const u = trail.userData, N = u.N;
    if (!on) { u.pts.length = 0; trail.visible = false; return; }
    u.pts.push(sp.slice());
    if (u.pts.length > N) u.pts.shift();
    trail.visible = u.pts.length > 2;
    const pos = trail.geometry.attributes.position, col = trail.geometry.attributes.color;
    const fast = spd > 16;
    const w = fast ? 0.045 : 0.018;
    const camP = camera.position;
    for (let i = 0; i < N; i++) {
      const p = u.pts[Math.min(i, u.pts.length - 1)] || sp;
      const q = u.pts[Math.min(i + 1, u.pts.length - 1)] || p;
      const dir = new T.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
      const toC = new T.Vector3(camP.x - p[0], camP.y - p[1], camP.z - p[2]);
      const side = new T.Vector3().crossVectors(dir, toC).normalize().multiplyScalar(w * (i / N));
      pos.setXYZ(i * 2, p[0] + side.x, p[1] + side.y, p[2] + side.z);
      pos.setXYZ(i * 2 + 1, p[0] - side.x, p[1] - side.y, p[2] - side.z);
      const a = (i / N) * (fast ? 0.7 : 0.35);
      const c = fast ? [1, 0.85, 0.45] : [1, 1, 1];
      col.setXYZW(i * 2, c[0], c[1], c[2], a); col.setXYZW(i * 2 + 1, c[0], c[1], c[2], a);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  function shuttleDir(m) {
    const sh = m.shuttle, f = sh.flight;
    if (!f || !sh.inPlay) return [0, 0, -1];
    const k = sh.pi, k0 = Math.max(0, k - 2), k1 = Math.min(f.n - 1, k + 1);
    const d = [f.pts[k1 * 4] - f.pts[k0 * 4], f.pts[k1 * 4 + 1] - f.pts[k0 * 4 + 1], f.pts[k1 * 4 + 2] - f.pts[k0 * 4 + 2]];
    return Math.hypot(d[0], d[1], d[2]) > 1e-6 ? d : [0, 0, -1];
  }

  // ---------- hiệu ứng ----------
  R3.effect = function (e) {
    if (e.type === 'hit') {
      const big = e.shot === 'jsmash' || e.shot === 'smash' || e.shot === 'kill';
      fx.bursts.push({ p: [e.x, e.y, e.z], t: 0, big });
      if (e.kmh > 160 && big) {
        fx.pops.push({ p: [e.x, e.y, e.z + 0.4], t: 0, text: Math.round(e.kmh) + ' km/h', col: '#ffd34d' });
        shake = Math.min(7, e.kmh / 55);
      }
      // cầu vừa bị đánh: đế quay ngược lại rồi lật về phía trước
      shQ.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), Math.PI * 0.85));
      lastShot = e.shot;
      tumbleT = (e.shot === 'net' || e.shot === 'crossnet' || e.shot === 'serve_short') ? 0.75 : 0;
      trail.userData.pts.length = 0;
    } else if (e.type === 'land') {
      fx.bursts.push({ p: [e.x, e.y, 0.02], t: 0, dust: true });
    }
  };

  function drawOverlay(dt) {
    octx.clearRect(0, 0, W, H);
    for (let i = fx.bursts.length - 1; i >= 0; i--) {
      const b = fx.bursts[i]; b.t += dt;
      const life = b.dust ? 0.6 : 0.35;
      if (b.t > life) { fx.bursts.splice(i, 1); continue; }
      const q = toScreen(b.p), k = b.t / life;
      if (q.z > 1) continue;
      octx.strokeStyle = `rgba(255,255,255,${(b.dust ? 0.5 : 1) * (1 - k)})`; octx.lineWidth = b.big ? 3 : 2;
      octx.beginPath();
      if (b.dust) octx.ellipse(q.x, q.y, (0.05 + k * 0.3) * q.s, (0.02 + k * 0.12) * q.s, 0, 0, 6.283);
      else octx.arc(q.x, q.y, (b.big ? 0.5 : 0.3) * q.s * (0.3 + k), 0, 6.283);
      octx.stroke();
      if (b.big) for (let j = 0; j < 8; j++) {
        const a = j * 0.785 + 0.3, r1 = 0.2 * q.s * (0.5 + k), r2 = 0.6 * q.s * (0.5 + k);
        octx.beginPath(); octx.moveTo(q.x + Math.cos(a) * r1, q.y + Math.sin(a) * r1); octx.lineTo(q.x + Math.cos(a) * r2, q.y + Math.sin(a) * r2); octx.stroke();
      }
    }
    for (let i = fx.pops.length - 1; i >= 0; i--) {
      const b = fx.pops[i]; b.t += dt;
      if (b.t > 1.3) { fx.pops.splice(i, 1); continue; }
      const q = toScreen([b.p[0], b.p[1], b.p[2] + b.t * 0.6]);
      octx.globalAlpha = Math.min(1, (1.3 - b.t) * 2);
      octx.font = `900 ${Math.max(15, Math.min(34, q.s * 0.3))}px system-ui, sans-serif`;
      octx.textAlign = 'center'; octx.lineWidth = 4; octx.strokeStyle = 'rgba(0,0,0,0.7)';
      octx.strokeText(b.text, q.x, q.y); octx.fillStyle = b.col; octx.fillText(b.text, q.x, q.y);
      octx.globalAlpha = 1;
    }
  }

  // vòng báo điểm rơi: vàng = chưa tới, xanh = đứng đủ gần để đánh
  function updateMarker(m, now) {
    const sh = m.shuttle, me = m.players[0];
    let show = false;
    if (m.phase === 'rally' && sh.flight && sh.hitter !== 0 && !sh.flight.netHit) {
      const since = m.t - sh.tHit, showAt = me.d.reactTime * 1.3;
      if (since >= showAt) {
        show = true;
        const L = sh.flight.land;
        const a = Math.min(1, (since - showAt) / 0.2);
        const rr = 0.18 + (100 - me.stats.react) * 0.004;
        const pulse = 1 + Math.sin(now * 10) * 0.08;
        const ok = !!m.findContact(me, 3, true);
        const c = ok ? '#50ff8c' : '#ffd63c';
        marker.position.set(L.x, L.y, 0.014); marker.scale.setScalar((rr * pulse) / 0.25);
        markerDot.position.set(L.x, L.y, 0.015);
        marker.material.color.set(c); markerDot.material.color.set(c);
        marker.material.opacity = 0.9 * a; markerDot.material.opacity = a;
      }
    }
    marker.visible = markerDot.visible = show;
  }

  // ---------- khung hình chính ----------
  // tự giảm độ phân giải khi máy không kịp 50 khung/giây (giữ mượt trên điện thoại yếu)
  let lastNow = 0, perfAcc = 0, perfN = 0, prScale = 1;
  function adapt(dt) {
    perfAcc += dt; perfN++;
    if (perfN < 90) return;
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
    const base = Math.min(2, window.devicePixelRatio || 1);
    if (avg > 0.021 && prScale > 0.5) prScale -= 0.15;
    else if (avg < 0.0155 && prScale < 1) prScale = Math.min(1, prScale + 0.1);
    else return;
    renderer.setPixelRatio(Math.max(0.75, base * prScale));
    renderer.setSize(W, H, false);
  }
  R3.draw = function (m, now) {
    if (!R3.ok) return;
    const dt = lastNow ? Math.min(0.05, now - lastNow) : 0.016;
    lastNow = now;
    adapt(dt);
    if (tumbleT > 0) tumbleT = Math.max(0, tumbleT - dt * (m.opts ? m.opts.timeScale : 1));
    if (m.phase === 'replay' && m.replay) return drawReplay(m, dt);
    const me = m.players[0], op = m.players[1], sh = m.shuttle;
    camX += (BL.clamp(me.x * 0.35 + (sh.inPlay ? sh.x * 0.15 : 0), -1.1, 1.1) - camX) * Math.min(1, dt * 3);
    const deep = Math.max(sh.inPlay && sh.y > 0 ? sh.y : 0, op.y);
    camK += (BL.clamp((deep - 3.2) / 2.6, 0, 1) - camK) * Math.min(1, dt * 2.2);
    const k = BL.smooth(camK);
    let cx = BL.lerp(fit.n.cx, fit.d.cx, k), cy = BL.lerp(fit.n.cy, fit.d.cy, k);
    if (shake > 0.05) { cx += (Math.random() - 0.5) * shake; cy += (Math.random() - 0.5) * shake; shake *= Math.pow(0.02, dt); }
    applyCam([MAIN_POS[0] + camX, MAIN_POS[1], MAIN_POS[2]], [MAIN_TGT[0] + camX * 0.8, MAIN_TGT[1], MAIN_TGT[2]], BL.lerp(fit.n.focal, fit.d.focal, k), cx, cy);
    const snaps = m.players.map((p) => BL.snapPlayer(p, m));
    const sp = [sh.x, sh.y, sh.z];
    const held = m.phase === 'serve' && m.players[m.score.server].holding;
    updateHumans(snaps, sp, held);
    const spd = sh.flight && sh.inPlay ? sh.flight.pts[sh.pi * 4 + 3] : 0;
    placeShuttle(sp, held ? [0, 0, -1] : shuttleDir(m), dt, spd);
    updateTrail(sp, spd, sh.inPlay && m.phase === 'rally');
    updateMarker(m, now);
    renderer.render(scene, camera);
    drawOverlay(dt);
  };

  // ---------- tua lại Mắt diều hâu ----------
  let rpLine = null, rpMark = null;
  function drawReplay(m, dt) {
    const rp = m.replay, fr = rp.frames;
    if (!fr.length) return;
    const t = m.phaseT;
    let idx = Math.floor(Math.max(0, t - rp.intro) * 120 * rp.slow);
    const done = idx >= fr.length - 1;
    idx = Math.min(fr.length - 1, idx);
    const f = fr[idx];
    const Lx = rp.x, Ly = rp.y, line = rp.margin.idx;
    let pos;
    if (line === 0 || line === 3) pos = [Lx + Math.sign(Lx || 1) * 0.2, Ly - Math.sign(Ly) * 2.6, 1.25];
    else pos = [Lx + (Lx > 0 ? -1.6 : 1.6), Ly + Math.sign(Ly) * 1.2, 1.25];
    const focal = Math.min(W, H) * 1.05;
    applyCam(pos, [Lx, Ly, 0.15], focal, W / 2, H * 0.58);
    updateHumans(f.p, f.s, false);
    placeShuttle(f.s, f.d || [0, 0, -1], dt * 0.25, f.v || 0);
    shuttle.scale.setScalar(0.7);
    marker.visible = markerDot.visible = false;
    trail.visible = false;
    // đường bay nét đứt
    if (!rpLine) {
      rpLine = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({ color: '#ffd85a', dashSize: 0.05, gapSize: 0.035 }));
      rpLine.frustumCulled = false; scene.add(rpLine);
      rpMark = new T.Mesh(new T.CircleGeometry(0.02, 20), new T.MeshBasicMaterial({ color: '#4dff8c', depthWrite: false }));
      rpMark.position.z = 0.013; scene.add(rpMark);
    }
    const pts = [];
    for (let i = Math.max(0, idx - 90); i <= idx; i++) pts.push(new T.Vector3(fr[i].s[0], fr[i].s[1], fr[i].s[2]));
    rpLine.geometry.dispose();
    rpLine.geometry = new T.BufferGeometry().setFromPoints(pts);
    rpLine.computeLineDistances();
    rpLine.visible = true;
    rpMark.visible = done;
    rpMark.position.set(Lx, Ly, 0.013);
    rpMark.material.color.set(rp.inside ? '#4dff8c' : '#ff4d4d');
    renderer.render(scene, camera);
    shuttle.scale.setScalar(1);
    rpLine.visible = false; rpMark.visible = false;
    // chữ
    octx.clearRect(0, 0, W, H);
    octx.fillStyle = 'rgba(0,0,0,0.55)'; octx.fillRect(0, 0, W, H * 0.09); octx.fillRect(0, H * 0.91, W, H * 0.09);
    octx.fillStyle = '#fff'; octx.font = `800 ${Math.max(14, H * 0.04)}px system-ui, sans-serif`; octx.textAlign = 'left'; octx.textBaseline = 'middle';
    octx.fillText('◉ TUA LẠI • MẮT DIỀU HÂU', 16, H * 0.045);
    octx.textAlign = 'right'; octx.fillStyle = '#ffd34d';
    octx.fillText('x' + rp.slow.toFixed(2) + ' chậm', W - 72, H * 0.045);
    if (done) {
      const ok = rp.inside, mm = Math.abs(rp.margin.m * 1000);
      octx.textAlign = 'center';
      octx.font = `900 ${Math.max(36, H * 0.14)}px system-ui, sans-serif`;
      octx.lineWidth = 8; octx.strokeStyle = 'rgba(0,0,0,0.7)';
      octx.strokeText(ok ? 'TRONG' : 'NGOÀI', W / 2, H * 0.27);
      octx.fillStyle = ok ? '#4dff8c' : '#ff4d4d';
      octx.fillText(ok ? 'TRONG' : 'NGOÀI', W / 2, H * 0.27);
      octx.font = `700 ${Math.max(14, H * 0.04)}px system-ui, sans-serif`;
      octx.fillStyle = '#fff';
      octx.fillText(ok ? `Đế cầu chạm vạch — còn ${mm < 1 ? '< 1' : mm.toFixed(0)} mm tới mép ngoài ${rp.margin.line}` : `Ra ngoài ${rp.margin.line} ${mm < 1 ? '< 1' : mm.toFixed(0)} mm`, W / 2, H * 0.955);
    }
  }

  // cho test: cảnh dựng sẵn để chụp
  R3._dbg = { get scene() { return scene; }, get camera() { return camera; }, get renderer() { return renderer; }, applyCam, updateHumans, placeShuttle };
})();
