// Luật cầu lông đơn (BWF): tính điểm rally 21, cách 2, chạm 30; ô giao cầu chéo; cầu chạm vạch là TRONG.
(function (G) {
  const BL = G.BL;
  const C = BL.C;

  BL.FORMATS = {
    quick: { name: 'Nhanh: 1 ván 11 điểm', games: 1, points: 11, cap: 15, interval: 6 },
    one: { name: '1 ván 21 điểm', games: 1, points: 21, cap: 30, interval: 11 },
    bwf: { name: 'Chuẩn BWF: 3 ván 21', games: 3, points: 21, cap: 30, interval: 11 },
  };

  BL.newScore = function (fmtId) {
    const f = BL.FORMATS[fmtId] || BL.FORMATS.one;
    return { fmt: f, fmtId, pts: [0, 0], games: [0, 0], gameNo: 1, history: [], server: 0, intervalDone: false };
  };

  // idx: 0 = người chơi, 1 = bot. Trả về sự kiện.
  BL.addPoint = function (sc, idx) {
    const f = sc.fmt;
    sc.pts[idx]++;
    sc.server = idx; // bên thắng pha cầu giao tiếp
    const a = sc.pts[idx], b = sc.pts[1 - idx];
    const ev = { gameOver: false, matchOver: false, interval: false };
    // thắng ván: đạt điểm và hơn 2, hoặc chạm điểm trần (29-29 -> 30)
    if ((a >= f.points && a - b >= 2) || a >= f.cap) {
      sc.games[idx]++;
      sc.history.push(sc.pts.slice());
      ev.gameOver = true;
      ev.gameWinner = idx;
      const need = Math.ceil(f.games / 2);
      if (sc.games[idx] >= need) {
        ev.matchOver = true;
        ev.matchWinner = idx;
      } else {
        sc.gameNo++;
        sc.pts = [0, 0];
        sc.intervalDone = false;
        // người thắng ván trước giao trước ở ván sau
        sc.server = idx;
      }
    } else if (!sc.intervalDone && a === f.interval && b < f.interval) {
      sc.intervalDone = true;
      ev.interval = true; // nghỉ giữa ván khi một bên đạt 11 điểm
    }
    // Game point / match point
    if (!ev.gameOver) {
      const lead = (i) => sc.pts[i] >= f.points - 1 && sc.pts[i] > sc.pts[1 - i] || sc.pts[i] === f.cap - 1;
      ev.gamePoint = lead(0) ? 0 : lead(1) ? 1 : -1;
    }
    return ev;
  };

  // Bên giao đứng ô phải khi điểm của mình chẵn, ô trái khi lẻ
  BL.serveCourt = (sc) => (sc.pts[sc.server] % 2 === 0 ? 'R' : 'L');

  // side: -1 (sân mình, y<0) hoặc +1 (sân bot). Bên phải của người đứng ở side nhìn về lưới: x dấu -side.
  BL.courtXSign = (side, rl) => (rl === 'R' ? -side : side);

  const EPS = C.CORK_R;
  // Cầu rơi trong sân đơn ở nửa sân `side`?
  BL.inSingles = function (x, y, side) {
    if (y * side < -EPS) return false;
    return Math.abs(x) <= C.HALF_W_S + EPS && Math.abs(y) <= C.HALF_L + EPS;
  };
  // Cầu giao rơi trong ô giao cầu (chéo) của bên nhận?
  BL.inServiceBox = function (x, y, recvSide, rl) {
    if (!BL.inSingles(x, y, recvSide)) return false;
    if (Math.abs(y) < C.SHORT_SVC - EPS) return false; // ngắn hơn vạch giao cầu gần
    const sx = BL.courtXSign(recvSide, rl);
    return x * sx >= -C.LINE_W / 2 - EPS; // vạch giữa thuộc cả hai ô
  };

  // Khoảng cách (m, có dấu: + là trong, - là ngoài) tới vạch quyết định gần nhất
  BL.lineMargin = function (x, y, side, serve) {
    const ms = [];
    ms.push(C.HALF_W_S + EPS - Math.abs(x));
    ms.push(C.HALF_L + EPS - Math.abs(y));
    if (serve) {
      ms.push(Math.abs(y) - (C.SHORT_SVC - EPS));
      const sx = BL.courtXSign(side, serve.rl);
      ms.push(x * sx + C.LINE_W / 2 + EPS);
    }
    let best = ms[0], bi = 0;
    // cầu TRONG khi mọi biên đều >= 0 -> biên quyết định là biên có giá trị nhỏ nhất
    for (let i = 1; i < ms.length; i++) if (ms[i] < best) { best = ms[i]; bi = i; }
    const names = ['biên dọc', 'biên cuối', 'vạch giao cầu', 'vạch giữa'];
    return { m: best, line: names[bi], idx: bi };
  };
})(typeof window !== 'undefined' ? window : globalThis);
