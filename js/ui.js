// Giao diện: menu, thang đối thủ, nâng cấp chỉ số, luật, cài đặt, HUD, cần điều khiển, vòng lặp chính.
(function () {
  const BL = window.BL;
  const $ = (s) => document.querySelector(s);
  const KEY = 'caulong_save_v1';

  // ---------- lưu tiến trình ----------
  const DEF = {
    stats: BL.defaultStats(), sp: 20, beaten: -1, color: '#e5392f', name: 'Bạn', tut: false,
    settings: { format: 'one', speed: 0.8, lineCall: true, autoMove: false, autoHit: false, reflex: true, sound: true, vib: true },
    record: { w: 0, l: 0, maxSmash: 0 },
  };
  let save;
  try { save = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { save = null; }
  save = Object.assign({}, DEF, save || {});
  save.settings = Object.assign({}, DEF.settings, save.settings || {});
  save.stats = Object.assign({}, DEF.stats, save.stats || {});
  save.record = Object.assign({}, DEF.record, save.record || {});
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* bộ nhớ bị chặn */ } };
  BL.Sound.on = save.settings.sound;

  // ---------- trạng thái ----------
  let match = null, demo = null, paused = false, oppIdx = 0, ev0 = 0, overTimer = 0;
  const cv = $('#cv');
  BL.Render.init(cv);
  window.addEventListener('resize', () => BL.Render.resize());

  function newDemo() {
    const a = BL.OPPONENTS[5], b = BL.OPPONENTS[4];
    demo = new BL.Match({ format: 'bwf', timeScale: 0.85, p0: Object.assign({ ctrl: 'bot' }, a, { color: '#e5392f', shorts: '#1b1d28' }), p1: Object.assign({ ctrl: 'bot' }, b) });
  }
  newDemo();

  // ---------- màn hình ----------
  const scr = $('#screens');
  function show(html, cls) {
    scr.innerHTML = html ? `<div class="screen ${cls || ''}"><div class="card">${html}</div></div>` : '';
    scr.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { BL.Sound.unlock(); BL.Sound.play('click'); go(b.dataset.go, b.dataset); }));
  }
  const pct = (v) => Math.round(v * 100) + '%';

  function go(where, data) {
    if (where === 'menu') menu();
    else if (where === 'ladder') ladder();
    else if (where === 'up') upgrade();
    else if (where === 'rules') rules();
    else if (where === 'set') settings(data && data.from);
    else if (where === 'play') startMatch(+data.i);
    else if (where === 'resume') resume();
    else if (where === 'quit') quit();
    else if (where === 'next') { startMatch(Math.min(BL.OPPONENTS.length - 1, oppIdx + (match && match.winner === 0 ? 1 : 0))); }
    else if (where === 'again') startMatch(oppIdx);
  }

  function menu() {
    $('#hud').classList.add('hidden');
    const r = save.record;
    show(`
      <h1>🏸 CẦU LÔNG <span>ĐỈNH CAO</span></h1>
      <div class="tag">Đánh đơn • Vật lý cầu lông thật • Luật BWF • Mắt diều hâu<br>Thành tích: <b>${r.w}</b> thắng / <b>${r.l}</b> thua • Đập nhanh nhất: <b>${Math.round(r.maxSmash)} km/h</b></div>
      <div class="menuBtns">
        <button class="big pri" data-go="ladder">▶ THI ĐẤU<small>Thắng để mở khoá đối thủ mạnh hơn</small></button>
        <button class="big" data-go="up">💪 Nhân vật & nâng cấp<small>${save.sp} điểm kỹ năng chưa dùng</small></button>
        <button class="big" data-go="rules">📖 Luật & cách chơi<small>Luật BWF, quỹ đạo cầu, công thức chỉ số</small></button>
        <button class="big" data-go="set" data-from="menu">⚙ Cài đặt<small>Tốc độ trận, thể thức, hỗ trợ</small></button>
      </div>
      <div id="rot" class="tag" style="position:static;transform:none;margin-top:12px">Mẹo: chơi xoay ngang điện thoại cho rộng sân. Thêm vào màn hình chính để chơi toàn màn hình.</div>
    `);
  }

  function ladder() {
    const avg = (s) => Math.round(Object.values(s).reduce((a, b) => a + b, 0) / 7);
    const myAvg = avg(save.stats);
    const rows = BL.OPPONENTS.map((o, i) => {
      const lock = i > save.beaten + 1;
      const cls = lock ? 'lock' : i <= save.beaten ? 'beat' : '';
      return `<button class="opp ${cls}" ${lock ? 'disabled' : `data-go="play" data-i="${i}"`}>
        <span class="av" style="background:${o.color}"></span>
        <span class="inf"><b>${i + 1}. ${o.name}</b><small>${o.style} • thưởng ${o.reward} điểm KN</small></span>
        <span class="lv">${avg(o.stats)}<small>${lock ? '🔒 khoá' : 'chỉ số TB'}</small></span></button>`;
    }).join('');
    show(`<h2><button class="back" data-go="menu">←</button> Chọn đối thủ <span class="sp">Bạn: TB ${myAvg}</span></h2>
      <div class="tag">Thể thức: <b>${BL.FORMATS[save.settings.format].name}</b> • đổi trong Cài đặt</div>${rows}`);
  }

  function effects(st) {
    const d = BL.derive(st);
    return {
      wrist: `Đập <b>${Math.round(d.smash * 3.6)} km/h</b> • bỏ nhỏ hở lưới <b>${Math.round(d.netClear * 100)} cm</b> • tạt <b>${Math.round(d.drive * 3.6)} km/h</b>`,
      arm: `Đập <b>${Math.round(d.smash * 3.6)} km/h</b> • lực phông tối đa <b>${Math.round(d.clearMax * 3.6)} km/h</b>`,
      stamina: `Hao sức <b>x${d.drain.toFixed(2)}</b> • hồi <b>${d.regen.toFixed(1)}</b>/giây`,
      flex: `Tầm với <b>${(d.reach * 1.3).toFixed(2)} m</b> (lao người) • bật nhảy <b>${Math.round(d.jump * 100)} cm</b>`,
      tech: `Sai số <b>x${d.acc.toFixed(2)}</b> • cách vạch <b>${Math.round(d.sideMargin * 100)} cm</b> • điều cầu <b>${Math.round(d.control)}</b>`,
      foot: `Chạy <b>${d.speed.toFixed(2)} m/s</b> (${(d.speed * 3.6).toFixed(1)} km/h) • tăng tốc <b>${d.accel.toFixed(1)} m/s²</b>`,
      react: `Khởi động <b>${Math.round(d.reactTime * 1000)} ms</b> • phòng thủ <b>${Math.round(d.defense)}</b>`,
    };
  }

  function upgrade() {
    const ef = effects(save.stats);
    const rows = BL.STATS.map((s) => {
      const v = save.stats[s.id], cost = BL.statCost(v);
      const can = save.sp >= cost && v < BL.STAT_MAX;
      return `<div class="stat"><div class="ic">${s.icon}</div>
        <div class="nm">${s.name}<span>${v}</span></div>
        <button class="plus" data-up="${s.id}" ${can ? '' : 'disabled'}>+1<small>${v >= BL.STAT_MAX ? 'tối đa' : cost + ' điểm'}</small></button>
        <div class="bar"><div style="width:${v}%"></div></div>
        <div class="ef">${s.desc}<br>${ef[s.id]}</div></div>`;
    }).join('');
    const cols = ['#e5392f', '#ff8a1e', '#f2c522', '#2fbf71', '#1fa7c9', '#8e5cf0', '#ef4fa6', '#f5f5f5'];
    show(`<h2><button class="back" data-go="menu">←</button> Nhân vật <span class="sp">${save.sp} điểm KN</span></h2>
      <div class="tag">Mỗi lần nâng tốn 1 điểm (từ cấp 20: 2 điểm, từ 40: 3 điểm...). Thắng trận nhận điểm kỹ năng.</div>
      <div class="swatches">${cols.map((c) => `<button style="background:${c}" class="${c === save.color ? 'on' : ''}" data-col="${c}"></button>`).join('')}</div>
      ${rows}
      <div class="row2" style="margin-top:12px"><button class="back" id="respec">↺ Đặt lại điểm (hoàn 100%)</button></div>`);
    scr.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.up, v = save.stats[id], c = BL.statCost(v);
      if (save.sp >= c && v < BL.STAT_MAX) { save.sp -= c; save.stats[id]++; persist(); BL.Sound.unlock(); BL.Sound.play('up'); upgrade(); }
    }));
    scr.querySelectorAll('[data-col]').forEach((b) => b.addEventListener('click', () => { save.color = b.dataset.col; persist(); upgrade(); }));
    $('#respec').addEventListener('click', () => {
      let refund = 0;
      for (const s of BL.STATS) { for (let v = 30; v < save.stats[s.id]; v++) refund += BL.statCost(v); for (let v = save.stats[s.id]; v < 30; v++) refund -= BL.statCost(v); save.stats[s.id] = 30; }
      save.sp += refund; persist(); upgrade();
    });
  }

  // ví dụ tính thật theo chỉ số hiện tại của bạn
  function oddsExample() {
    const ctx = { vin: 24, hd: 0.6, tAvail: 0.35, reflex: false, kind: 'net', z: 1.0 };
    const mk = (st) => ({ d: BL.derive(st), energy: 100, ctrl: 'human', reachMul: 1.12 });
    const mine = BL.contactOdds(mk(save.stats), ctx).prob;
    const strong = {}; for (const s of BL.STATS) strong[s.id] = save.stats[s.id];
    strong.react = Math.min(99, strong.react + 25); strong.wrist = Math.min(99, strong.wrist + 15);
    const better = BL.contactOdds(mk(strong), ctx).prob;
    const refl = BL.contactOdds(mk(save.stats), Object.assign({}, ctx, { reflex: true })).prob;
    return `Ví dụ với chỉ số hiện tại của bạn: bị đập tới người ~86 km/h (24 m/s), chỉ còn 0.35 s, phải với 0.6 m → tỉ lệ đỡ tốt <b>${pct(mine)}</b> (nếu để máy tự đỡ phản xạ: ${pct(refl)}). Nâng Phản ứng +25 và Cổ tay +15 → <b>${pct(better)}</b>. Ngược lại nâng Cánh tay để cú đập của bạn nhanh hơn, ép tỉ lệ đỡ của bot xuống.`;
  }

  function rules() {
    show(`<h2><button class="back" data-go="menu">←</button> Luật & cách chơi</h2>
      <h3>Điều khiển</h3>
      <p>• <b>Cần trái</b>: di chuyển. Lúc chạm cầu, đẩy cần sang trái/phải = đánh cầu về hướng đó (không đẩy: tự đánh vào chỗ trống của đối thủ).<br>
      • <b>3 nút phải</b> đổi theo chỗ bạn đứng:<br>
      &nbsp;&nbsp;— <b>Trên lưới</b> (cách lưới &lt; 2.3 m): 🪶 Bỏ nhỏ • ↗ Kéo cầu chéo sang lưới bên kia • ⤴ Hất cầu ra cuối sân<br>
      &nbsp;&nbsp;— <b>Giữa sân</b>: ➟ Tạt ngang • 🛡 Đỡ cầu bật lên cao sâu • 💥 Nhảy đập<br>
      &nbsp;&nbsp;— <b>Cuối sân</b> (&gt; 4.5 m): 🍃 Ve cầu (rơi gần lưới) • 🌈 Phông cầu (cao sâu) • 💥 Nhảy đập<br>
      • Bấm nút <b>trước</b> khi cầu tới: nhân vật tự vung đúng lúc cầu vào tầm. Vòng <b style="color:#ffd34d">vàng</b> = điểm cầu rơi, chuyển <b style="color:#4dff8c">xanh</b> khi bạn đứng đủ gần để đánh.<br>
      • Cầu quá thấp để đập sẽ tự đổi thành tạt/đỡ; cầu bổng sát lưới khi bấm bỏ nhỏ sẽ thành <b>chụp lưới</b>. Bị đập mà chưa bấm: tự <b>đỡ phản xạ</b> (yếu hơn bấm chủ động).<br>
      • Bàn phím: <kbd>WASD</kbd>/<kbd>mũi tên</kbd> di chuyển, <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> = 3 nút, <kbd>P</kbd> tạm dừng.</p>
      <h3>Luật BWF đánh đơn</h3>
      <p>• Tính điểm trực tiếp (rally point): mỗi pha cầu đều có điểm. Ván tới <b>21</b>, phải hơn <b>2</b> điểm; 29-29 thì ai được <b>30</b> thắng. Trận chuẩn: thắng 2/3 ván. Nghỉ khi một bên chạm 11.<br>
      • Bên thắng pha cầu được giao. Điểm người giao <b>chẵn → ô phải</b>, <b>lẻ → ô trái</b>; cầu giao phải bay chéo vào ô đối diện.<br>
      • Giao cầu: chạm cầu dưới <b>1.15 m</b>, đánh từ dưới lên. Sân đơn khi giao: hẹp (biên dọc trong), dài tới biên cuối, phải qua vạch giao cầu gần (1.98 m).<br>
      • Pha cầu: sân đơn (5.18 × 13.40 m). Cầu <b>chạm vạch là TRONG</b>. Chạm lưới không qua / lọt dưới lưới / ra ngoài = lỗi. Cầu chạm mép lưới rồi lăn qua vẫn tính.<br>
      • Lưới cao 1.524 m giữa sân, 1.55 m ở cột. Cầu rơi cách vạch &lt; 8 cm: <b>Mắt diều hâu</b> tua chậm rồi mới xử.</p>
      <h3>Quỹ đạo cầu</h3>
      <p>Cầu lông chịu lực cản không khí rất lớn tỉ lệ bình phương vận tốc. Vận tốc rơi tối đa ~6.8 m/s nên cầu bay theo đường cong <b>không đối xứng</b>: lao nhanh lúc đầu, chậm hẳn và rơi gần như thẳng đứng ở cuối. Cú đập 350 km/h chỉ còn ~60–90 km/h khi tới người đỡ.</p>
      <div class="formula">a = −g·ẑ − K·|v|·v      K = g / 6.8² ≈ 0.212 /m
v(s) ≈ v0 · e^(−K·s)   (giảm theo quãng đường)
Tích phân RK4 bước 1/240 s; cú đánh = giải ngược góc + lực để rơi đúng đích</div>
      <h3>Chỉ số → sức mạnh</h3>
      <div class="formula">Tốc độ đập (m/s)  = 40 + 0.40·Cánh tay + 0.20·Cổ tay  (+3..8 khi nhảy)
Lực phông/hất      = 38 + 0.22·Cánh tay + 0.10·Cổ tay
Tạt                = 24 + 0.12·Cánh tay + 0.14·Cổ tay
Hở lưới bỏ nhỏ (m) = 0.20 − 0.0011·Cổ tay − 0.0007·Kỹ thuật
Sai số             = 1.65 − 0.0105·Kỹ thuật  (× bị ép × với xa × mệt)
Tầm với            = 0.92 + 0.0045·Dẻo dai  (×1.3 khi lao người)
Bật nhảy (m)       = 0.12 + 0.0042·Dẻo dai + 0.0008·Cánh tay
Tốc chạy (m/s)     = 3.2 + 0.03·Tốc độ chân   (tăng tốc 8 + 0.16·Tốc độ chân)
Khởi động (s)      = 0.32 − 0.0022·Phản ứng
Cú mềm (ve/bỏ nhỏ/tạt/đỡ): sai số × (1.25 − 0.005·Cổ tay); đối thủ chậm thêm 0.02 + 0.0012·Cổ tay giây
Phòng thủ          = 0.35·Phản ứng + 0.25·Cổ tay + 0.25·Kỹ thuật + 0.15·Dẻo dai
Điều cầu           = 0.50·Kỹ thuật + 0.25·Cổ tay + 0.25·Dẻo dai
Hao sức            = 1.3 − 0.006·Thể lực;  hồi = 5 + 0.1·Thể lực</div>
      <h3>Đỡ được hay không? (chênh lệch chỉ số)</h3>
      <div class="formula">Độ khó = 2.7·(tốc độ cầu tới − 8) + 24·(độ với)² + 70·(0.55 − thời gian phản ứng có được)
Kỹ năng = Phòng thủ (cầu nhanh) hoặc Điều cầu (cầu chậm); đỡ phản xạ tự động −8
Tỉ lệ chạm tốt = 1 / (1 + e^−((Kỹ năng − Độ khó + 16)/7))   (mệt làm Độ khó tăng tới 35%)
Bấm nút chủ động: Kỹ năng +6 so với bot; hết thể lực: chạy chậm tới 20%, sai số tăng tới 60%
Hỏng → cầu đánh khung: rúc lưới, bổng ngắn dễ bị đập, hoặc văng ra ngoài.</div>
      <p>${oddsExample()}</p>
    `);
  }

  function settings(from) {
    const s = save.settings;
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const onoff = (key) => seg(key, [[true, 'Bật'], [false, 'Tắt']]);
    show(`<h2><button class="back" data-go="${from === 'pause' ? 'resume' : 'menu'}">←</button> Cài đặt</h2>
      <div class="set"><label>Thể thức<small>áp dụng trận sau</small></label>${seg('format', [['quick', '1 ván 11'], ['one', '1 ván 21'], ['bwf', '3 ván 21']])}</div>
      <div class="set"><label>Tốc độ trận<small>"Thật" = tốc độ cầu ngoài đời</small></label>${seg('speed', [[0.6, 'Chậm'], [0.8, 'Vừa'], [1, 'Thật']])}</div>
      <div class="set"><label>Mắt diều hâu<small>tua chậm khi cầu sát vạch</small></label>${onoff('lineCall')}</div>
      <div class="set"><label>Tự đỡ phản xạ<small>tự đưa vợt khi bị đập mà chưa bấm</small></label>${onoff('reflex')}</div>
      <div class="set"><label>Tự chạy tới cầu<small>hỗ trợ người mới: chỉ cần bấm nút</small></label>${onoff('autoMove')}</div>
      <div class="set"><label>Tự chọn cú đánh<small>không bấm thì máy chọn hộ</small></label>${onoff('autoHit')}</div>
      <div class="set"><label>Âm thanh</label>${onoff('sound')}</div>
      <div class="set"><label>Rung</label>${onoff('vib')}</div>
      <div class="row2" style="margin-top:14px"><button class="back" id="wipe">🗑 Xoá toàn bộ tiến trình</button></div>`);
    scr.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.k; let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (!isNaN(+v)) v = +v;
      s[k] = v; persist(); BL.Sound.on = s.sound;
      if (match) { match.opts.lineCall = s.lineCall; match.opts.autoMove = s.autoMove; match.opts.autoHit = s.autoHit; match.opts.reflex = s.reflex; match.opts.timeScale = s.speed; }
      settings(from);
    }));
    $('#wipe').addEventListener('click', () => {
      if (confirm('Xoá hết chỉ số, điểm kỹ năng và đối thủ đã thắng?')) { save = JSON.parse(JSON.stringify(DEF)); persist(); settings(from); }
    });
  }

  // ---------- trận đấu ----------
  function startMatch(i) {
    oppIdx = i;
    const o = BL.OPPONENTS[i];
    const s = save.settings;
    match = new BL.Match({
      format: s.format, lineCall: s.lineCall, autoMove: s.autoMove, autoHit: s.autoHit, reflex: s.reflex, timeScale: s.speed,
      p0: { name: save.name, stats: save.stats, ctrl: 'human', color: save.color, shorts: '#1b1d28', hair: '#1a120c', skin: '#e0aa82' },
      p1: Object.assign({ ctrl: 'bot' }, o, { shorts: '#f1f1f1' }),
      firstServer: BL.rand() < 0.5 ? 0 : 1,
    });
    ev0 = 0; paused = false; overTimer = 0;
    show('');
    $('#hud').classList.remove('hidden');
    $('#sbn0').textContent = save.name;
    $('#sbn1').textContent = o.name;
    document.documentElement.style.setProperty('--me', save.color);
    document.documentElement.style.setProperty('--op', o.color);
    lastZone = '';
    flash(`Gặp ${o.name}`, BL.FORMATS[s.format].name, 2.2);
    if (!save.tut) tutorial();
    BL.Sound.unlock();
    BL.Sound.play('whistle');
  }

  function tutorial() {
    paused = true;
    const d = document.createElement('div');
    d.className = 'tut';
    d.innerHTML = `<div class="card"><h2>🏸 Cách chơi nhanh</h2>
      <p>1. <b>Kéo cần trái</b> để chạy tới vòng <b style="color:#ffd34d">vàng</b> (chỗ cầu rơi). Đứng đúng chỗ, vòng chuyển <b style="color:#4dff8c">xanh</b>.<br>
      2. <b>Bấm 1 trong 3 nút phải</b> trước khi cầu tới — nhân vật tự vung đúng lúc.<br>
      3. Nút đổi theo chỗ đứng: <b>trên lưới</b> / <b>giữa sân</b> / <b>cuối sân</b>.<br>
      4. Giao cầu: bấm Giao ngắn / Giao cao sâu / Giao bổng nhanh.<br>
      5. Đẩy cần sang trái/phải lúc đánh để chọn hướng cầu.</p>
      <button class="big pri" id="tutOk" style="width:100%;text-align:center">ĐÃ HIỂU — VÀO TRẬN</button></div>`;
    document.body.appendChild(d);
    d.querySelector('#tutOk').addEventListener('click', () => { save.tut = true; persist(); d.remove(); paused = false; });
  }

  function pause() {
    if (!match || match.phase === 'over') return;
    paused = true;
    show(`<h2>Tạm dừng</h2>
      <div class="menuBtns">
        <button class="big pri" data-go="resume">▶ Tiếp tục</button>
        <button class="big" data-go="set" data-from="pause">⚙ Cài đặt</button>
        <button class="big" data-go="quit">✖ Bỏ trận (tính thua)</button>
      </div>`);
  }
  function resume() { show(''); paused = false; }
  function quit() {
    if (match && match.phase !== 'over') { save.record.l++; persist(); }
    match = null; paused = false; menu();
  }
  $('#pauseBtn').addEventListener('click', pause);

  function result() {
    const m = match, me = m.players[0], op = m.players[1], win = m.winner === 0;
    const o = BL.OPPONENTS[oppIdx];
    let gain;
    if (win) {
      gain = o.reward + (oppIdx > save.beaten ? 5 : 0);
      save.beaten = Math.max(save.beaten, oppIdx);
      save.record.w++;
    } else {
      const myPts = m.score.history.reduce((a, h) => a + h[0], 0) + m.score.pts[0];
      gain = 2 + Math.floor(myPts / 6);
      save.record.l++;
    }
    save.sp += gain;
    save.record.maxSmash = Math.max(save.record.maxSmash, me.st.maxSmash);
    persist();
    const games = m.score.history.map((h) => `${h[0]}-${h[1]}`).join(' • ');
    const row = (a, l, b) => `<tr><td>${a}</td><td class="c">${l}</td><td>${b}</td></tr>`;
    const def = (p) => p.st.defOk + p.st.defFail ? pct(p.st.defOk / (p.st.defOk + p.st.defFail)) : '–';
    show(`<div class="res">
      <div class="tag">${save.name} vs ${o.name}</div>
      <div class="big1" style="color:${win ? 'var(--ok)' : 'var(--bad)'}">${win ? 'CHIẾN THẮNG!' : 'THUA RỒI'}</div>
      <div style="font-size:22px;font-weight:900">${games}</div>
      <table>
        ${row(me.st.hits, 'Số cú đánh', op.st.hits)}
        ${row(me.st.winners, 'Điểm ghi trực tiếp', op.st.winners)}
        ${row(me.st.errors, 'Lỗi (lưới/ra ngoài)', op.st.errors)}
        ${row(me.st.smash, 'Cú đập', op.st.smash)}
        ${row(Math.round(me.st.maxSmash) + ' km/h', 'Đập nhanh nhất', Math.round(op.st.maxSmash) + ' km/h')}
        ${row(def(me), 'Đỡ cầu khó thành công', def(op))}
        ${row(m.longest, 'Pha cầu dài nhất', '')}
      </table>
      <div class="gain">+${gain} điểm kỹ năng</div>
      <div class="menuBtns">
        ${win && oppIdx < BL.OPPONENTS.length - 1 ? '<button class="big pri" data-go="next">▶ Đối thủ tiếp theo</button>' : '<button class="big pri" data-go="again">↻ Đấu lại</button>'}
        <button class="big" data-go="up">💪 Nâng cấp (${save.sp} điểm)</button>
        <button class="big" data-go="menu">⌂ Menu</button>
      </div></div>`);
    $('#hud').classList.add('hidden');
  }

  // ---------- HUD ----------
  let msgT = 0, subT = 0;
  function flash(t, small, dur) {
    const el = $('#msg');
    el.innerHTML = t + (small ? `<small>${small}</small>` : '');
    el.classList.add('on');
    msgT = dur || 1.6;
  }
  function sub(t, dur) {
    const el = $('#sub');
    el.textContent = t; el.classList.add('on'); subT = dur || 1.4;
  }
  const btnEls = [...document.querySelectorAll('.shot')];
  let lastZone = '';
  function updateHud(dt) {
    const m = match;
    const sc = m.score;
    $('#sbp0').textContent = sc.pts[0]; $('#sbp1').textContent = sc.pts[1];
    $('#sbg0').textContent = sc.games[0]; $('#sbg1').textContent = sc.games[1];
    $('#srv0').textContent = sc.server === 0 ? '🏸' : ''; $('#srv1').textContent = sc.server === 1 ? '🏸' : '';
    $('#enBar').style.width = Math.round(m.players[0].energy) + '%';
    $('#hud').classList.toggle('replay', m.phase === 'replay');
    const zone = m.zone(0);
    const shots = m.buttons(0);
    if (zone !== lastZone) {
      lastZone = zone;
      $('#zoneLbl').textContent = BL.ZONES[zone].name.toUpperCase();
      btnEls.forEach((b, i) => { const s = BL.SHOTS[shots[i]]; b.querySelector('i').textContent = s.icon; b.querySelector('b').textContent = s.name; b.dataset.shot = shots[i]; });
    }
    const me = m.players[0];
    const q = me.intent ? me.intent.shot : me.swing && !me.swing.hit ? me.swing.shot : null;
    btnEls.forEach((b) => b.classList.toggle('q', !!q && b.dataset.shot === q));
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('#msg').classList.remove('on'); }
    if (subT > 0) { subT -= dt; if (subT <= 0) $('#sub').classList.remove('on'); }
  }

  function vib(ms) { if (save.settings.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* bỏ qua */ } }

  function handleEvents(m, isDemo) {
    while (ev0 < m.events.length) {
      const e = m.events[ev0++];
      BL.Render.effect(e);
      if (isDemo) continue;
      const S = BL.Sound;
      if (e.type === 'hit') {
        const k = BL.SHOTS[e.shot].kind;
        if (k === 'smash') S.play('smash'); else if (k === 'net' || e.shot === 'serve_short') S.play('soft'); else S.play('hit');
        if (e.who === 0) {
          vib(k === 'smash' ? 30 : 12);
          sub(BL.SHOTS[e.shot].name + (k === 'smash' || e.shot === 'drive' || e.shot === 'clear' ? ` • ${Math.round(e.kmh)} km/h` : ''), 1.1);
        } else if (k === 'smash') sub(`Đối thủ ${BL.SHOTS[e.shot].name.toLowerCase()} ${Math.round(e.kmh)} km/h!`, 1.2);
      } else if (e.type === 'contact') {
        if (!e.ok && e.who === 0) flash('Đỡ hỏng!', `tỉ lệ chạm tốt chỉ ${pct(e.prob)}`, 1.2);
        else if (!e.ok && e.who === 1) flash('Đối thủ đỡ hỏng!', `tỉ lệ của bot ${pct(e.prob)}`, 1.2);
        else if (e.reflex && e.who === 0) sub(`Đỡ phản xạ! (${pct(e.prob)})`, 1);
      } else if (e.type === 'whiff') {
        if (e.who === 0) sub('Vụt hụt — đứng chưa tới!', 1.2);
      } else if (e.type === 'netcord') S.play('net');
      else if (e.type === 'land') { S.play(m.shuttle.flight.netHit ? 'net' : 'land'); }
      else if (e.type === 'replay') { flash('Cầu sát vạch!', 'Mắt diều hâu đang xem lại…', 1.3); S.play('whistle'); }
      else if (e.type === 'point') {
        const mine = e.winner === 0;
        S.play('whistle');
        setTimeout(() => S.play(mine ? 'cheer' : 'aww', 1), 250);
        flash(mine ? 'ĐIỂM CHO BẠN' : 'ĐIỂM CHO ĐỐI THỦ', e.reason + (e.ev.gamePoint === 0 ? ' • GAME POINT' : e.ev.gamePoint === 1 ? ' • đối thủ GAME POINT' : ''), 1.6);
        if (mine) vib([20, 40, 20]);
      } else if (e.type === 'interval') flash('Nghỉ giữa ván', 'một bên đã chạm 11 điểm', 2.6);
      else if (e.type === 'gameover') flash(e.winner === 0 ? 'Bạn thắng ván!' : 'Đối thủ thắng ván', `ván ${m.score.gameNo} bắt đầu sau ít giây`, 3.5);
      else if (e.type === 'over') { overTimer = 2.2; flash(e.winner === 0 ? 'CHIẾN THẮNG!' : 'KẾT THÚC', '', 2.2); S.play('cheer', 1.6); }
      else if (e.type === 'servePos') {
        if (e.server === 0) sub(`Bạn giao • ô ${e.rl === 'R' ? 'phải' : 'trái'} (điểm ${match.score.pts[0] % 2 ? 'lẻ' : 'chẵn'})`, 1.8);
      }
    }
    if (m.events.length > 150) { m.events.splice(0, ev0); ev0 = 0; }
  }

  // ---------- điều khiển ----------
  const joy = { id: null, x0: 0, y0: 0, x: 0, y: 0 };
  const keys = {};
  const base = $('#joyBase'), knob = $('#joyKnob'), zoneEl = $('#joyZone');
  const R0 = 60;
  function setKnob(dx, dy) { knob.style.transform = `translate(${dx}px, ${dy}px)`; }
  zoneEl.addEventListener('pointerdown', (e) => {
    BL.Sound.unlock();
    joy.id = e.pointerId; zoneEl.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect();
    joy.x0 = r.left + r.width / 2; joy.y0 = r.top + r.height / 2;
    // cần nổi: đặt tâm ở chỗ chạm nếu chạm xa
    if (Math.hypot(e.clientX - joy.x0, e.clientY - joy.y0) > 70) {
      const zr = zoneEl.getBoundingClientRect();
      base.style.left = (e.clientX - zr.left - 66) + 'px';
      base.style.bottom = (zr.bottom - e.clientY - 66) + 'px';
      joy.x0 = e.clientX; joy.y0 = e.clientY;
    }
    moveJoy(e);
    $('#joyHint').style.display = 'none';
  });
  function moveJoy(e) {
    let dx = e.clientX - joy.x0, dy = e.clientY - joy.y0;
    const l = Math.hypot(dx, dy);
    if (l > R0) { dx *= R0 / l; dy *= R0 / l; }
    joy.x = dx / R0; joy.y = dy / R0;
    setKnob(dx, dy);
  }
  zoneEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(e); });
  const endJoy = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.x = joy.y = 0; setKnob(0, 0);
    base.style.left = ''; base.style.bottom = '';
  };
  zoneEl.addEventListener('pointerup', endJoy);
  zoneEl.addEventListener('pointercancel', endJoy);

  function pressBtn(i) {
    if (!match || paused) return;
    const shots = match.buttons(0);
    match.press(0, shots[i]);
    BL.Sound.unlock();
    vib(8);
  }
  btnEls.forEach((b, i) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('dn'); pressBtn(i); });
    const up = () => b.classList.remove('dn');
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'KeyJ' || e.code === 'Digit1') pressBtn(0);
    if (e.code === 'KeyK' || e.code === 'Digit2') pressBtn(1);
    if (e.code === 'KeyL' || e.code === 'Digit3') pressBtn(2);
    if (e.code === 'KeyP' || e.code === 'Escape') { if (paused && match) resume(); else pause(); }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden && match && !paused && match.phase !== 'over') pause(); });

  function readInput() {
    let x = joy.x, y = joy.y;
    const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const ky = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (kx || ky) { const l = Math.hypot(kx, ky); x = kx / l; y = ky / l; }
    const me = match.players[0];
    me.input.mx = x; me.input.my = -y; // màn hình lên = về phía lưới (+y)
    me.input.aimX = x;
  }

  // ---------- vòng lặp ----------
  let last = performance.now();
  function frame(now) {
    if (window.__freeze) { requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (match) {
      if (!paused) {
        readInput();
        match.update(dt);
        handleEvents(match, false);
        updateHud(dt);
        if (overTimer > 0) { overTimer -= dt; if (overTimer <= 0) result(); }
      }
      BL.Render.draw(match, now / 1000);
    } else {
      demo.update(dt);
      while (demo.events.length) BL.Render.effect(demo.events.shift());
      if (demo.phase === 'over') newDemo();
      BL.Render.draw(demo, now / 1000);
    }
    requestAnimationFrame(frame);
  }
  menu();
  requestAnimationFrame(frame);

  // cho test tự động
  window.__game = { get match() { return match; }, get save() { return save; }, startMatch, pressBtn, joy, menu };
})();
