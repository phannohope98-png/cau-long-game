// Vật lý quả cầu lông: trọng lực + lực cản khí động học bậc 2 (a = -K|v|v - g).
// Cầu lông có lực cản rất lớn: vận tốc giảm theo hàm mũ với quãng đường (v = v0·e^(-K·s)),
// nên cú đập 300 km/h chỉ còn ~60-80 km/h khi tới người đỡ, và cầu cao rơi gần như thẳng đứng
// ở cuối quỹ đạo (đường cong "bất đối xứng" đặc trưng). Tích phân RK4, bước 1/240 s.
(function (G) {
  const BL = G.BL;
  const C = BL.C;
  const K = C.K, GR = C.G;

  function deriv(vx, vy, vz) {
    const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
    return [-K * v * vx, -K * v * vy, -K * v * vz - GR];
  }

  // Một bước RK4 cho trạng thái s = [x,y,z,vx,vy,vz] (sửa tại chỗ)
  function rk4(s, dt) {
    const [x, y, z, vx, vy, vz] = s;
    const a1 = deriv(vx, vy, vz);
    const v2x = vx + a1[0] * dt * 0.5, v2y = vy + a1[1] * dt * 0.5, v2z = vz + a1[2] * dt * 0.5;
    const a2 = deriv(v2x, v2y, v2z);
    const v3x = vx + a2[0] * dt * 0.5, v3y = vy + a2[1] * dt * 0.5, v3z = vz + a2[2] * dt * 0.5;
    const a3 = deriv(v3x, v3y, v3z);
    const v4x = vx + a3[0] * dt, v4y = vy + a3[1] * dt, v4z = vz + a3[2] * dt;
    const a4 = deriv(v4x, v4y, v4z);
    s[0] = x + (dt / 6) * (vx + 2 * v2x + 2 * v3x + v4x);
    s[1] = y + (dt / 6) * (vy + 2 * v2y + 2 * v3y + v4y);
    s[2] = z + (dt / 6) * (vz + 2 * v2z + 2 * v3z + v4z);
    s[3] = vx + (dt / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]);
    s[4] = vy + (dt / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
    s[5] = vz + (dt / 6) * (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2]);
  }
  BL.rk4 = rk4;

  // Mô phỏng toàn bộ đường bay từ lúc đánh tới lúc chạm sàn, xử lý cả lưới.
  // Trả về mảng điểm (x,y,z,tốc độ) mỗi bước DT: game cho cầu chạy đúng theo mảng này,
  // nên dự đoán (vòng rơi, bot tính đường chạy) khớp tuyệt đối với cầu thật.
  BL.simulateFlight = function (p0, v0, hitterSide) {
    const DT = C.DT;
    const s = [p0[0], p0[1], p0[2], v0[0], v0[1], v0[2]];
    const MAX = 2400;
    const pts = new Float32Array((MAX + 1) * 4);
    let n = 0;
    const push = () => {
      pts[n * 4] = s[0]; pts[n * 4 + 1] = s[1]; pts[n * 4 + 2] = s[2];
      pts[n * 4 + 3] = Math.hypot(s[3], s[4], s[5]);
      n++;
    };
    push();
    let crossed = false, netHit = false, netCord = false, crossIdx = -1, apex = s[2], underNet = false;
    let land = null;
    while (n < MAX) {
      const px = s[0], py = s[1], pz = s[2];
      rk4(s, DT);
      // Đi qua mặt phẳng lưới (y = 0)
      if (!crossed && !netHit && (py * hitterSide > 0) && (s[1] * hitterSide <= 0)) {
        const f = py / (py - s[1]);
        const cx = px + (s[0] - px) * f, cz = pz + (s[2] - pz) * f;
        const inPosts = Math.abs(cx) <= C.HALF_W_D + 0.02;
        const h = BL.netHeight(cx);
        if (inPosts && cz < h + 0.012 && cz > h - 0.035) {
          // Cầu chạm mép lưới (net cord): mất gần hết tốc độ, lăn qua hoặc rơi lại
          netCord = true;
          const over = BL.rand() < 0.55;
          s[0] = cx; s[2] = h + 0.02;
          s[1] = over ? -hitterSide * 0.02 : hitterSide * 0.02;
          s[3] *= 0.25;
          s[4] = (over ? -hitterSide : hitterSide) * (0.25 + BL.rand() * 0.5);
          s[5] = 0.3 + BL.rand() * 0.6;
          if (over) { crossed = true; crossIdx = n; }
          else netHit = true;
        } else if (inPosts && (cz <= h - 0.035)) {
          // Cầu đâm vào lưới (hoặc lọt dưới lưới — cũng là lỗi): rơi ở phía người đánh
          netHit = true;
          if (cz < 0.76) underNet = true;
          s[0] = cx; s[1] = hitterSide * 0.04; s[2] = cz;
          s[3] *= 0.05; s[4] = hitterSide * 0.2; s[5] = Math.min(0, s[5] * 0.1);
        } else {
          crossed = true;
          crossIdx = n;
        }
      }
      if (s[2] > apex) apex = s[2];
      if (s[2] <= 0) {
        const f = pz / (pz - s[2]);
        s[0] = px + (s[0] - px) * f;
        s[1] = py + (s[1] - py) * f;
        s[2] = 0;
        push();
        land = { x: s[0], y: s[1], idx: n - 1 };
        break;
      }
      push();
    }
    if (!land) land = { x: s[0], y: s[1], idx: n - 1 };
    return { pts, n, land, crossed, netHit, netCord, underNet, crossIdx, apex, tFlight: (n - 1) * DT };
  };

  // ---- Bộ giải quỹ đạo 2D (trong mặt phẳng thẳng đứng chứa hướng bay) ----
  // r: quãng đường ngang, z: độ cao. rNet: khoảng ngang tới lưới, hNet: chiều cao lưới tại đó.
  function fly2D(z0, speed, theta, rNet, hNet) {
    const DT = C.DT;
    let r = 0, z = z0, vr = speed * Math.cos(theta), vz = speed * Math.sin(theta);
    let zNet = null, t = 0, apex = z0, vNet = 0;
    for (let i = 0; i < 3000; i++) {
      // RK2 trong mặt phẳng (đủ chính xác cho bộ giải; game dùng RK4 để chạy thật)
      const v1 = Math.hypot(vr, vz);
      const ar1 = -K * v1 * vr, az1 = -K * v1 * vz - GR;
      const mr = vr + ar1 * DT * 0.5, mz = vz + az1 * DT * 0.5;
      const v2 = Math.hypot(mr, mz);
      const ar2 = -K * v2 * mr, az2 = -K * v2 * mz - GR;
      const nr = r + mr * DT, nz = z + mz * DT;
      if (zNet === null && r <= rNet && nr > rNet) {
        const f = (rNet - r) / (nr - r);
        zNet = z + (nz - z) * f;
        vNet = v2;
      }
      vr += ar2 * DT; vz += az2 * DT;
      t += DT;
      if (nz <= 0) {
        const f = z / (z - nz);
        r = r + (nr - r) * f;
        return { range: r, zNet: zNet === null ? -1 : zNet, clear: zNet === null ? -9 : zNet - hNet, t, apex, vEnd: Math.hypot(vr, vz), vNet };
      }
      r = nr; z = nz;
      if (z > apex) apex = z;
    }
    return { range: r, zNet: zNet === null ? -1 : zNet, clear: zNet === null ? -9 : zNet - hNet, t, apex, vEnd: Math.hypot(vr, vz), vNet };
  }
  BL.fly2D = fly2D;

  // Góc cố định -> tìm tốc độ để rơi đúng khoảng cách d (tầm xa tăng đơn điệu theo tốc độ)
  BL.solveSpeed = function (z0, theta, d, rNet, hNet, sMin, sMax) {
    let lo = sMin, hi = sMax;
    let r = fly2D(z0, hi, theta, rNet, hNet);
    if (r.range < d) return { speed: hi, theta, res: r, short: true };
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      r = fly2D(z0, mid, theta, rNet, hNet);
      if (r.range < d) lo = mid; else hi = mid;
    }
    r = fly2D(z0, hi, theta, rNet, hNet);
    return { speed: hi, theta, res: r, short: false };
  };

  // Tốc độ cố định -> tìm góc trong [tMin,tMax] (tầm xa tăng đơn điệu theo góc trong khoảng này)
  BL.solveAngle = function (z0, speed, d, rNet, hNet, tMin, tMax) {
    let lo = tMin, hi = tMax;
    let rHi = fly2D(z0, speed, hi, rNet, hNet);
    if (rHi.range < d) return { speed, theta: hi, res: rHi, short: true };
    let rLo = fly2D(z0, speed, lo, rNet, hNet);
    if (rLo.range > d) return { speed, theta: lo, res: rLo, long: true };
    let r = rHi;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      r = fly2D(z0, speed, mid, rNet, hNet);
      if (r.range < d) lo = mid; else hi = mid;
    }
    r = fly2D(z0, speed, hi, rNet, hNet);
    return { speed, theta: hi, res: r };
  };
})(typeof window !== 'undefined' ? window : globalThis);
