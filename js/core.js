// Hằng số, toán vector, bộ sinh số ngẫu nhiên. Dùng chung cho game và test Node.
(function (G) {
  const BL = (G.BL = G.BL || {});

  // Đơn vị: mét, giây. Trục: x ngang sân, y dọc sân (lưới ở y=0), z cao.
  // Sân MÌNH (người chơi) ở y<0 (side = -1), sân BOT ở y>0 (side = +1).
  const C = (BL.C = {
    G: 9.81,
    VT: 6.8, // vận tốc rơi tối đa của quả cầu lông lông vũ (đo thực nghiệm ~6.7-6.9 m/s)
    HALF_L: 6.7, // nửa chiều dài sân (13.40 m)
    HALF_W_S: 2.59, // nửa chiều rộng sân đơn (5.18 m)
    HALF_W_D: 3.05, // nửa chiều rộng sân đôi (6.10 m)
    SHORT_SVC: 1.98, // vạch giao cầu gần cách lưới 1.98 m
    LONG_SVC_D: 0.76, // vạch giao cầu xa của đánh đôi cách biên cuối 0.76 m
    NET_H_C: 1.524, // lưới giữa sân 1.524 m
    NET_H_P: 1.55, // cột lưới 1.55 m
    LINE_W: 0.04,
    CORK_R: 0.013, // bán kính đế cầu
    DT: 1 / 240,
    SERVE_MAX_H: 1.15, // luật giao cầu: điểm chạm cầu dưới 1.15 m
  });
  C.K = C.G / (C.VT * C.VT); // hệ số cản bậc 2: a = -K|v|v

  BL.netHeight = function (x) {
    const u = Math.min(1, Math.abs(x) / C.HALF_W_D);
    return C.NET_H_C + (C.NET_H_P - C.NET_H_C) * u * u;
  };

  BL.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  BL.lerp = (a, b, t) => a + (b - a) * t;
  BL.smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  BL.sigmoid = (x) => 1 / (1 + Math.exp(-x));

  // RNG có seed (mulberry32) để test lặp lại được
  let seed = (Date.now() ^ 0x5bd1e995) >>> 0;
  BL.setSeed = (s) => (seed = s >>> 0);
  BL.rand = function () {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  BL.randRange = (a, b) => a + (b - a) * BL.rand();
  BL.gauss = function () {
    let u = 0, v = 0;
    while (u === 0) u = BL.rand();
    v = BL.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  BL.pick = (arr) => arr[Math.floor(BL.rand() * arr.length)];

  BL.v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm: (a) => {
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      return [a[0] / l, a[1] / l, a[2] / l];
    },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
  };
})(typeof window !== 'undefined' ? window : globalThis);
