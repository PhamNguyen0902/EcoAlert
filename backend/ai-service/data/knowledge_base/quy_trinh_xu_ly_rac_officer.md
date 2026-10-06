---
document_id: "sop_officer_illegal_dumping_v1"
category: "illegal_dumping"
target_role: "OFFICER"
doc_type: "sop_workflow"
version: "1.0"
updated_at: "2026-09-26"
scope: "Xử lý hiện trường và cập nhật trạng thái sự cố xả rác bừa bãi"
---

# QUY TRÌNH XỬ LÝ SỰ CỐ XẢ RÁC BỪA BÃI — DÀNH CHO OFFICER

**Đối tượng áp dụng:** Cán bộ tiếp nhận và xử lý sự cố (Officer) được hệ thống phân công (`assignedOfficerId === actor.id`).
**Mục tiêu của Officer:** Khảo sát thực địa, đánh giá hiện trường, điều phối lực lượng thu gom dọn sạch rác, chụp ảnh nghiệm thu và đóng sự cố trên hệ thống EcoAlert. Cán bộ hiện trường không thực hiện xử phạt tiền hoặc xử lý tài sản.
**Mã danh mục sự cố:** `category = illegal_dumping`
**Luồng trạng thái hệ thống:** `pending → assigned → in_progress → resolved`
**Phạm vi áp dụng duy nhất:** Hệ thống RAG này CHỈ hỗ trợ xử lý sự cố RÁC THẢI (xả rác bừa bãi, bãi rác tự phát, thu gom chất thải). Hoàn toàn KHÔNG tiếp nhận và KHÔNG hướng dẫn các loại sự cố khác như: Ngập lụt (Flooding), Ô nhiễm không khí (Air pollution), Ô nhiễm nguồn nước (Water pollution), Cây xanh gãy đổ (Fallen tree).

---

## BƯỚC 1: Khảo sát hiện trường

- **Trạng thái hệ thống:** `in_progress` (sau khi gọi `startHandling`)
- **Action tương ứng:** `startHandling()` → chuyển từ `assigned` sang `in_progress`

**Nhiệm vụ của Officer:**

1. Có mặt tại hiện trường đúng hạn quy định:
   - Trong vòng **30–60 phút** nếu mức độ `severity` là `HIGH` hoặc `CRITICAL`.
   - Trong vòng **2–4 giờ** nếu mức độ `severity` là `MEDIUM` hoặc `LOW`.
2. Gọi action `confirmArrival()` trên app để check-in tọa độ GPS (ghi nhận `arrivedAt`, `checkIn.location`, `checkIn.accuracyMeters`).
3. Chụp ảnh hiện trạng ban đầu: ảnh góc rộng toàn cảnh bãi rác và ảnh cận cảnh loại rác.
4. Ước lượng khối lượng và tính chất rác:
   - Khối lượng: Dưới 1m³ / Từ 1–3m³ / Trên 3m³.
   - Tính chất: Rác sinh hoạt thông thường, cành cây/xà bần, xác động vật, hoặc có dấu hiệu chất thải độc hại/bốc mùi nguy hiểm.

**Bước tiếp theo:** Chuyển sang Bước 2.

---

## BƯỚC 2: Đánh giá tình huống tại hiện trường

**Tình huống A — Phát hiện người/phương tiện đang có hành vi xả rác:**

1. Yêu cầu đối tượng dừng ngay hành vi xả rác.
2. Yêu cầu đối tượng tự giác thu gom lại số rác vừa vứt vào nơi quy định.
3. Chụp ảnh/ghi nhận lại hiện trường và thông tin sự việc vào ghi chú sự cố.
4. Nếu đối tượng không hợp tác hoặc có hành vi chống đối: Cán bộ hiện trường liên hệ ngay Công an khu vực hoặc UBND phường/xã để can thiệp hỗ trợ, không tự ý tranh chấp hoặc xử phạt.

**Tình huống B — Bãi rác tự phát tồn đọng (không có mặt người xả rác):**

1. Ghi nhận chi tiết hiện trạng bãi rác vào ứng dụng.
2. Kiểm tra vị trí khu đất: đất công cộng (vỉa hè, lòng đường, công viên) hay đất dự án/đất tư nhân chưa xây dựng để có phương án điều phối dọn dẹp phù hợp.

**Bước tiếp theo:** Chuyển sang Bước 3.

---

## BƯỚC 3: Điều phối thu gom và làm sạch

**Cán bộ hiện trường căn cứ theo khối lượng rác đã ước lượng ở Bước 1 để chọn giải pháp:**

- **Dưới 1m³ (quy mô nhỏ):** Huy động lực lượng tại chỗ như tổ dân phố, dân quân tự vệ hoặc đoàn thanh niên phối hợp dọn dẹp.
- **Trên 1m³ hoặc bốc mùi nguy hại (quy mô lớn):** Liên hệ đơn vị vệ sinh môi trường đô thị (URENCO hoặc hợp tác xã môi trường địa phương) điều xe chuyên dụng và công nhân đến thu gom.

**Giám sát thực địa:**

- Đảm bảo rác được thu gom sạch sẽ hoàn toàn.
- Yêu cầu rắc vôi bột hoặc phun khử trùng/khử mùi nếu bãi rác có nước rỉ rác hôi thối hoặc xác động vật.
  _(Lưu ý: Đơn vị/phương pháp dọn dẹp sẽ điền vào `treatmentMethod`, vật tư khử khuẩn/vôi bột sẽ điền vào `materialsUsed` khi đóng sự cố ở Bước 5)._

**Bước tiếp theo:** Chuyển sang Bước 4.

---

## BƯỚC 4: Phòng ngừa tái phát sinh bãi rác

1. Cắm biển nhắc nhở/cảnh báo cấm đổ rác tại khu vực vừa dọn sạch.
2. Bàn giao mặt bằng sạch cho Tổ trưởng tổ dân phố hoặc đại diện khu dân cư giám sát tự quản.
3. Trường hợp đây là điểm nóng đổ trộm tái diễn nhiều lần: Cán bộ hiện trường ghi chú kiến nghị UBND phường/xã xem xét bố trí thùng rác công cộng hoặc lắp camera giám sát.

**Bước tiếp theo:** Chuyển sang Bước 5.

---

## BƯỚC 5: Nghiệm thu & Đóng sự cố trên hệ thống

- **Trạng thái hệ thống:** Chuyển sang `resolved`
- **Action tương ứng:** `resolveIncident()`

**Cán bộ hiện trường cần hoàn thiện trên ứng dụng EcoAlert:**

1. Chụp tối thiểu **2 ảnh hiện trường sau khi dọn sạch** ("After photo") từ cùng góc chụp với ảnh ban đầu để làm bằng chứng đối chứng (nộp qua mảng `resolutionEvidence`, type `AFTER_TREATMENT`).
2. Nhập `resolutionSummary`: Tóm tắt kết quả (ví dụ: _"Đã thu gom sạch khoảng 1.5m³ rác sinh hoạt, khu vực đã được rắc vôi khử khuẩn và cắm biển cảnh báo"_).
3. Nhập `treatmentMethod`: Phương pháp/lực lượng xử lý (tự xử lý tại chỗ, huy động dân cư, hay điều phối xe URENCO).
4. Nhập `materialsUsed`: Các vật tư hỗ trợ nếu có (ví dụ: _"2 bao vôi bột, thuốc xịt khử mùi"_).
5. Nhấn hoàn tất để hệ thống chuyển trạng thái sự cố sang `resolved`.

**Đây là bước cuối cùng kết thúc quy trình.**

---

## CÂU HỎI THƯỜNG GẶP CỦA OFFICER (FAQ)

**Hỏi: Tôi vừa được phân công (assigned) sự cố xả rác, việc đầu tiên tôi phải làm là gì?**
Đáp: Bạn cần mở app và nhấn action `startHandling()` để chuyển sự cố sang `in_progress`, sau đó di chuyển đến hiện trường theo thời gian quy định (30–60 phút với HIGH/CRITICAL, 2–4 giờ với MEDIUM/LOW).

**Hỏi: Khi đến hiện trường tôi cần thao tác gì đầu tiên?**
Đáp: Bạn gọi `confirmArrival()` trên app để check-in vị trí GPS, sau đó chụp ảnh hiện trạng và ước lượng khối lượng rác (Bước 1).

**Hỏi: Nếu bắt gặp người đang vứt rác, tôi có được phạt tiền họ không?**
Đáp: Không. Cán bộ hiện trường không có thẩm quyền phạt tiền hay thu giữ tài sản. Bạn yêu cầu họ dừng hành vi và tự dọn dẹp rác. Nếu họ bất hợp tác hoặc chống đối, bạn liên hệ Công an hoặc UBND xã/phường hỗ trợ xử lý.

**Hỏi: Rác ít dưới 1m³ thì liên hệ ai dọn?**
Đáp: Khối lượng dưới 1m³ không cần gọi xe URENCO, bạn có thể huy động tổ dân phố, dân quân hoặc đoàn thanh niên tại chỗ phối hợp dọn dẹp (Bước 3).

**Hỏi: Rác nhiều trên 1m³ hoặc bốc mùi nguy hại thì xử lý thế nào?**
Đáp: Bạn liên hệ Đơn vị dịch vụ môi trường đô thị (URENCO/hợp tác xã môi trường) để điều xe ép rác chuyên dụng đến thu gom (Bước 3).

**Hỏi: Để hoàn tất và đóng sự cố trên hệ thống tôi cần những gì?**
Đáp: Bạn gọi `resolveIncident()`, gửi kèm tối thiểu 2 ảnh sau khi dọn sạch (cùng góc với ảnh ban đầu), ghi tóm tắt `resolutionSummary` và phương pháp xử lý `treatmentMethod` (Bước 5).

**Hỏi: Khu vực dọn xong có cần cắm biển cảnh báo không?**
Đáp: Có. Cần cắm biển nhắc nhở cấm đổ rác và bàn giao cho tổ dân phố tự quản ở Bước 4 để tránh tái phát.

**Hỏi: Nếu gặp hoặc được hỏi về sự cố ngập lụt, ô nhiễm nguồn nước hoặc không khí thì xử lý thế nào?**
Đáp: Hệ thống EcoAlert hiện tại chỉ hỗ trợ quy trình cho sự cố rác thải. Với sự cố ngập lụt, ô nhiễm nguồn nước, không khí hoặc cây đổ, Officer thông báo sự cố nằm ngoài phạm vi hỗ trợ của hệ thống và hướng dẫn liên hệ cơ quan chuyên trách địa phương (Công ty Thoát nước, Phòng TN&MT).

**Hỏi: Hành vi vứt rác sinh hoạt bị phạt bao nhiêu tiền?**
Đáp: Theo khoản 2 Điều 25 Nghị định 45/2022/NĐ-CP, mức phạt tiền áp dụng đối với cá nhân có hành vi vứt, thải rác sinh hoạt như sau: vứt tàn thuốc lá không đúng nơi quy định phạt 100.000 - 150.000 đồng; vứt rác sinh hoạt tại khu chung cư, thương mại, dịch vụ hoặc nơi công cộng phạt 500.000 - 1.000.000 đồng; vứt rác trên vỉa hè, lòng đường hoặc vào hệ thống thoát nước đô thị, ao hồ, kênh rạch, sông suối phạt 1.000.000 - 2.000.000 đồng; vận chuyển rác, nguyên vật liệu làm rơi vãi ra môi trường phạt 2.000.000 - 4.000.000 đồng. Người vi phạm buộc phải thu dọn rác và khôi phục lại tình trạng ban đầu.

**Hỏi: Không phân loại rác sinh hoạt bị phạt bao nhiêu tiền?**
Đáp: Theo khoản 1 Điều 26 Nghị định 45/2022/NĐ-CP, hộ gia đình, cá nhân không phân loại chất thải rắn sinh hoạt theo quy định hoặc không sử dụng bao bì chứa chất thải rắn sinh hoạt theo quy định bị phạt 500.000 - 1.000.000 đồng, áp dụng từ ngày 01/01/2025.

**Hỏi: Ai có thẩm quyền phạt tiền người vứt rác, Cán bộ hiện trường có được lập biên bản phạt không?**
Đáp: Cán bộ hiện trường không có thẩm quyền phạt tiền, lập biên bản xử phạt hay thu giữ tài sản của người dân. Cán bộ chỉ yêu cầu dừng hành vi, ghi nhận hiện trường và liên hệ Công an khu vực hoặc UBND phường/xã để người có thẩm quyền xử phạt theo Điều 25, Điều 26 Nghị định 45/2022/NĐ-CP.

**Hỏi: Điều 25 Nghị định 45/2022/NĐ-CP quy định gì về hành vi vứt rác?**
Đáp: Khoản 2 Điều 25 Nghị định 45/2022/NĐ-CP quy định mức phạt đối với các hành vi vứt, thải rác không đúng nơi quy định: vứt tàn thuốc lá nơi công cộng phạt 100.000 - 150.000 đồng; vứt rác tại khu chung cư, thương mại, dịch vụ hoặc nơi công cộng phạt 500.000 - 1.000.000 đồng; vứt rác trên vỉa hè, lòng đường hoặc vào hệ thống thoát nước phạt 1.000.000 - 2.000.000 đồng; vận chuyển nguyên vật liệu để rơi vãi ra môi trường phạt 2.000.000 - 4.000.000 đồng.

**Hỏi: Mức phạt vi phạm đối với tổ chức, công ty, doanh nghiệp xả rác được tính thế nào?**
Đáp: Theo khoản 2 Điều 6 Nghị định 45/2022/NĐ-CP, mức phạt tiền đối với tổ chức có cùng hành vi vi phạm môi trường gấp 02 lần mức phạt tiền đối với cá nhân. Cụ thể: tổ chức vứt rác tại khu chung cư, thương mại, dịch vụ, nơi công cộng bị phạt 1.000.000 - 2.000.000 đồng; tổ chức vứt rác trên vỉa hè, lòng đường hoặc vào hệ thống thoát nước đô thị, kênh rạch bị phạt 2.000.000 - 4.000.000 đồng; tổ chức vận chuyển hàng hóa, rác thải làm rơi vãi ra môi trường bị phạt 4.000.000 - 8.000.000 đồng.

**Hỏi: Xe chở rác hoặc vật liệu làm rơi vãi rác ra đường bị phạt bao nhiêu tiền?**
Đáp: Theo điểm e khoản 2 Điều 25 và khoản 2 Điều 6 Nghị định 45/2022/NĐ-CP, hành vi vận chuyển nguyên liệu, vật liệu, rác thải không che chắn hoặc để rơi vãi ra môi trường khi tham gia giao thông bị phạt tiền từ 2.000.000 - 4.000.000 đồng đối với cá nhân, và từ 4.000.000 - 8.000.000 đồng đối với tổ chức, đồng thời buộc phải khắc phục tình trạng ô nhiễm môi trường.