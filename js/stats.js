// 7 chỉ số nhân vật và quy tắc mỗi chỉ số làm mạnh cái gì.
(function (G) {
  const BL = G.BL;

  BL.STATS = [
    { id: 'wrist', name: 'Sức mạnh cổ tay', short: 'Cổ tay', icon: '✊',
      desc: 'Cú gập cổ tay: góp 30% tốc độ đập, quyết định độ sát lưới khi bỏ nhỏ, độ ảo của cú ve, độ nảy khi đỡ phản xạ và tốc độ tạt.' },
    { id: 'arm', name: 'Sức mạnh cánh tay', short: 'Cánh tay', icon: '💪',
      desc: 'Lực vung: nguồn chính của tốc độ đập, độ sâu phông cầu/hất cầu (tay yếu phông không tới cuối sân), tốc độ tạt.' },
    { id: 'stamina', name: 'Thể lực', short: 'Thể lực', icon: '❤',
      desc: 'Bình năng lượng hao chậm hơn và hồi nhanh hơn. Hết sức: chạy chậm, nhảy thấp, đánh kém chính xác.' },
    { id: 'flex', name: 'Dẻo dai', short: 'Dẻo dai', icon: '🤸',
      desc: 'Tầm với (bước lao/lunge), độ cao bật nhảy đập, hồi phục sau cú lao/nhảy, giảm sai số khi phải với xa.' },
    { id: 'tech', name: 'Kỹ năng kỹ thuật', short: 'Kỹ thuật', icon: '🎯',
      desc: 'Độ chính xác mọi cú đánh (sai số góc/lực nhỏ lại), ít đánh hỏng, đặt cầu sát vạch hơn, phán đoán cầu ra ngoài.' },
    { id: 'foot', name: 'Tốc độ chân', short: 'Bộ pháp', icon: '👟',
      desc: 'Tốc độ chạy tối đa và gia tốc khi đổi hướng — tới cầu sớm hơn để đánh ở điểm cao hơn.' },
    { id: 'react', name: 'Phản ứng', short: 'Phản ứng', icon: '⚡',
      desc: 'Thời gian khởi động sau cú đánh của đối thủ, 35% khả năng đỡ cú đập/tạt nhanh, vòng báo điểm rơi hiện sớm và chuẩn hơn.' },
  ];

  BL.STAT_MIN = 10;
  BL.STAT_MAX = 99;

  // Chỉ số dẫn xuất — tất cả công thức cân bằng nằm ở đây
  BL.derive = function (st) {
    const w = st.wrist, a = st.arm, s = st.stamina, f = st.flex, t = st.tech, ft = st.foot, r = st.react;
    return {
      smash: 40 + 0.4 * a + 0.2 * w, // m/s rời vợt (đập đứng)
      jumpBonus: 3 + 0.05 * f, // nhảy đập cộng thêm (góc dốc + trọng lượng cơ thể)
      clearMax: 38 + 0.22 * a + 0.1 * w, // tốc độ tối đa cho phông/hất
      drive: 24 + 0.12 * a + 0.14 * w,
      dropSpeed: 11 + 0.06 * w + 0.02 * a,
      netClear: Math.max(0.035, 0.2 - 0.0011 * w - 0.0007 * t), // khoảng hở trên lưới khi bỏ nhỏ (m)
      sideMargin: 0.56 - 0.003 * t, // đặt cầu cách biên dọc bao xa
      backMargin: 0.8 - 0.005 * t,
      acc: 1.65 - 0.0105 * t, // hệ số sai số (nhân vào sigma)
      reach: 0.92 + 0.0045 * f, // tầm với ngang từ tâm người (có vợt + bước lao)
      jump: 0.12 + 0.0042 * f + 0.0008 * a,
      reachUp: 2.42 + 0.0012 * f, // điểm chạm cao nhất khi đứng (đầu vợt)
      speed: 3.2 + 0.03 * ft, // m/s
      accel: 8 + 0.16 * ft,
      reactTime: 0.32 - 0.0022 * r,
      wrist: w,
      defense: 0.35 * r + 0.25 * w + 0.25 * t + 0.15 * f,
      control: 0.5 * t + 0.25 * w + 0.25 * f,
      drain: 1.3 - 0.006 * s,
      regen: 5 + 0.1 * s,
      judge: 0.55 - 0.0045 * t, // sai số phán đoán cầu ra ngoài (m)
    };
  };

  BL.statCost = (lv) => 1 + Math.floor(lv / 20);

  BL.defaultStats = () => ({ wrist: 30, arm: 30, stamina: 30, flex: 30, tech: 30, foot: 30, react: 30 });

  // Thang đối thủ
  const mk = (o) => o;
  BL.OPPONENTS = [
    mk({ id: 'tu', play: 'clear', name: 'Anh Tư Hẻm', style: 'Đánh phong trào, hay phông', color: '#2e7bd6', hair: '#2a1a10', skin: '#d9a07a',
      stats: { wrist: 16, arm: 22, stamina: 20, flex: 15, tech: 14, foot: 18, react: 16 }, aggro: 0.2, reward: 6 }),
    mk({ id: 'lan', play: 'net', name: 'Chị Lan CLB Phường', style: 'Bỏ nhỏ khó chịu', color: '#c2399b', hair: '#140c08', skin: '#e6b48f',
      stats: { wrist: 32, arm: 22, stamina: 30, flex: 28, tech: 34, foot: 26, react: 26 }, aggro: 0.15, reward: 8 }),
    mk({ id: 'hung', play: 'smash', name: 'Hùng "Búa"', style: 'Đập mạnh, thủ kém', color: '#2b2f3a', hair: '#1a1a1a', skin: '#c98f66',
      stats: { wrist: 40, arm: 55, stamina: 32, flex: 32, tech: 30, foot: 32, react: 28 }, aggro: 0.75, reward: 10 }),
    mk({ id: 'minh', play: 'defend', name: 'Minh Tường Đồng', style: 'Thủ chắc, chạy nhiều', color: '#2e9e5b', hair: '#221510', skin: '#dba580',
      stats: { wrist: 42, arm: 38, stamina: 60, flex: 50, tech: 46, foot: 55, react: 55 }, aggro: 0.3, reward: 12 }),
    mk({ id: 'vy', play: 'drive', name: 'Vy Tốc Độ', style: 'Tạt nhanh, ép sát lưới', color: '#e08a1e', hair: '#3b2414', skin: '#ecbd98',
      stats: { wrist: 62, arm: 50, stamina: 55, flex: 60, tech: 60, foot: 70, react: 65 }, aggro: 0.55, reward: 14 }),
    mk({ id: 'khang', play: 'all', name: 'Khang Tuyển Tỉnh', style: 'Toàn diện', color: '#6a3fc9', hair: '#0e0a08', skin: '#d39d76',
      stats: { wrist: 68, arm: 68, stamina: 68, flex: 66, tech: 70, foot: 68, react: 68 }, aggro: 0.5, reward: 17 }),
    mk({ id: 'quoc', play: 'smash', name: 'Quốc Gia Lâm', style: 'Đập 350 km/h', color: '#f2c522', hair: '#111', skin: '#c48a60',
      stats: { wrist: 80, arm: 88, stamina: 72, flex: 75, tech: 76, foot: 74, react: 75 }, aggro: 0.7, reward: 20 }),
    mk({ id: 'legend', play: 'all', name: 'Huyền Thoại Lin', style: 'Hoàn hảo', color: '#1d1d24', hair: '#050505', skin: '#d8a882',
      stats: { wrist: 92, arm: 90, stamina: 90, flex: 90, tech: 94, foot: 90, react: 92 }, aggro: 0.6, reward: 30 }),
  ];
})(typeof window !== 'undefined' ? window : globalThis);
