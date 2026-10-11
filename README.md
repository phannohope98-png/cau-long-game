# 🏸 Cầu Lông Đỉnh Cao

Game cầu lông đánh đơn chạy trên trình duyệt điện thoại — chơi tại **https://phannohope98-png.github.io/cau-long-game/**

- Người thật 3D: mô hình người có khung xương đầy đủ cả 5 ngón (mô hình Ready Player Me trong bộ ví dụ của three.js, nạp lúc chạy từ jsDelivr; mất mạng thì dùng người dựng sẵn), mặc đồ thi đấu tự may bám xương, tóc ngắn ôm sọ, tay nắm cán vợt kiểu bắt tay.
- 4 nút mỗi vùng, biểu tượng vẽ đường bay của cú; thế đứng thủ / thế trên lưới theo tình huống.
- Đồ hoạ 3D (WebGL/Three.js): nhà thi đấu, sàn gỗ, thảm BWF, lưới, đèn & bóng đổ, người 3D có khối cơ, vợt & cầu lông vũ 3D (cầu lật đầu, xoáy khi bỏ nhỏ).
- Động tác đúng kỹ thuật: bước đệm, bước đuổi, đập nghiêng vai + đá chéo chân, lao người, trái tay, vồ lưới.
- Góc nhìn chéo từ trên xuống sau lưng: thấy cả sân mình, nhân vật mình và một phần sân đối thủ.
- Cần điều khiển bên trái; 3 nút bên phải đổi theo chỗ đứng (trên lưới / giữa sân / cuối sân).
- Vật lý cầu lông thật: lực cản bậc 2, vận tốc rơi tối đa 6.8 m/s, quỹ đạo bất đối xứng; mọi cú đánh được giải ngược ra góc + lực.
- 7 chỉ số (cổ tay, cánh tay, thể lực, dẻo dai, kỹ thuật, tốc độ chân, phản ứng) quyết định tốc độ đập, độ sát lưới, tầm với, tỉ lệ đỡ…
- Luật BWF: 21 điểm, cách 2, chạm 30; ô giao cầu chéo theo điểm chẵn/lẻ; cầu chạm vạch là trong.
- Mắt diều hâu: cầu rơi cách vạch < 8 cm thì tua chậm rồi mới xử.
- 8 đối thủ bot từ phong trào tới huyền thoại.

Test: `node test/sim.js` (bot đấu bot), `node test/human.js` (giả lập người bấm nút), `node test/statvalue.js` (giá trị từng chỉ số), `node test/shots.js` (độ chính xác từng cú).
