# Thông báo tiếng Việt EcoAlert

## Phạm vi và nguyên nhân

- Consumer RabbitMQ trước đây hardcode tiếng Anh, đưa ObjectId/category/severity enum vào nội dung.
- AI gửi đến `System` (không phải công dân), phát thông báo cần xác minh cho toàn bộ Officer; assignment/close của Officer thiếu `alertId`.
- Generic `ALERT_UPDATED` không phân biệt sửa nội dung với chuyển trạng thái, dễ báo trùng/sai.
- PATCH/DELETE chỉ theo notification ID; shared `isRead` bị thay đổi cho mọi người.
- Socket.IO nhận `userId/role` từ client, broadcast nguyên payload báo cáo đến tất cả kết nối.

Không sửa ReportFlow, camera, YOLO, GPS, offline queue, màn Citizen khác hoặc dashboard Admin. Hai thay đổi Admin chưa commit được giữ riêng.

## Danh mục nội dung chuẩn

Nguồn chuẩn: `backend/notification-service/src/utils/notification-content.ts`. UI mobile có fallback tương thích cho cache cũ; test kiểm tra hai catalog khớp nhau.

| Người nhận / sự kiện thật | Tiêu đề | Nội dung mặc định |
| --- | --- | --- |
| Citizen / tạo báo cáo | Báo cáo của bạn đã được tiếp nhận | EcoAlert đã ghi nhận báo cáo điểm rác của bạn. Báo cáo đang chờ kiểm tra và xử lý. |
| Citizen / AI thành công | Đã có kết quả phân tích báo cáo | Hệ thống đã hoàn tất phân tích hình ảnh điểm rác bạn gửi. Kết quả đang chờ xác minh. |
| Citizen / VERIFIED | Báo cáo đã được xác minh | Báo cáo điểm rác của bạn đã được xác minh và đang chờ phân công cán bộ xử lý. |
| Citizen / phân công | Đã phân công cán bộ xử lý | Báo cáo điểm rác của bạn đã được giao cho cán bộ phụ trách. Bạn có thể theo dõi tiến độ trong ứng dụng. |
| Citizen / bắt đầu | Báo cáo đang được xử lý | Cán bộ phụ trách đã bắt đầu xử lý điểm rác bạn phản ánh. |
| Citizen / đến hiện trường | Cán bộ đã đến hiện trường | Cán bộ đã xác nhận có mặt tại vị trí điểm rác để thực hiện xử lý. |
| Citizen / RESOLVED | Điểm rác đã được xử lý | Cán bộ đã gửi kết quả và hình ảnh sau xử lý. Báo cáo đang chờ quản trị viên kiểm tra. |
| Citizen / CLOSED | Báo cáo đã hoàn tất | Kết quả xử lý điểm rác đã được xác nhận. Cảm ơn bạn đã góp phần giữ gìn môi trường xanh sạch. |
| Citizen / REJECTED | Báo cáo chưa được chấp thuận | Báo cáo của bạn chưa được chấp thuận sau khi kiểm tra. Nhấn để xem thông tin chi tiết. |
| Officer được giao / phân công | Bạn có nhiệm vụ mới | Một báo cáo điểm rác đã được phân công cho bạn. Vui lòng xem chi tiết và bắt đầu xử lý. |
| Officer phụ trách / CLOSED | Nhiệm vụ đã được xác nhận hoàn tất | Quản trị viên đã kiểm tra và đóng báo cáo bạn xử lý. |
| Admin / tạo báo cáo | Có báo cáo mới cần kiểm tra | Một báo cáo điểm rác đang chờ xác minh. Vui lòng kiểm tra thông tin trước khi phân công. |
| Admin / RESOLVED | Có kết quả xử lý cần kiểm tra | Cán bộ đã gửi kết quả và hình ảnh sau xử lý. Vui lòng kiểm tra trước khi đóng báo cáo. |
| Legacy cập nhật chưa xác định chuyển trạng thái | Cập nhật trạng thái báo cáo | Báo cáo của bạn có cập nhật. Nhấn để xem thông tin chi tiết. |
| Legacy không nhận diện được | Thông báo từ EcoAlert | Bạn có một thông báo trong ứng dụng. Vui lòng kiểm tra thông tin chi tiết. |

Tên báo cáo an toàn được thêm ở cuối nội dung, trim và giới hạn 90 ký tự. Bỏ tên nếu chứa HTML, email, URL, token, ID dài hoặc mã kỹ thuật. Không tự tạo lý do từ chối/mã báo cáo.

Không bổ sung lịch nhắc việc hoặc thông báo auto-assignment thất bại: chưa có event tương ứng được xác nhận trong nguồn hiện tại. AI `FAILED` không được mô tả là phân tích thành công.

## Event, lịch sử và tương thích

- Giữ nguyên event constants và routing keys. `eventId` chỉ dedup; `alertId` riêng và chỉ nhận ObjectId hợp lệ để điều hướng.
- AI producer thêm metadata tùy chọn `citizenId/title`; Alert consumer chấp nhận hai trường này, không đổi phân tích AI.
- Chuyển VERIFIED/REJECTED có `previousStatus`; generic edit/companion event có `workflowNotificationHandled` không tạo thông báo.
- Unique index recipient/event chống trùng, kể cả xử lý đồng thời. Chỉ phát `notification:created` khi mới insert, sau persistence.
- API đọc lịch sử chạy formatter; không migration ghi đè. Ưu tiên type/eventType, rồi exact legacy title và exact mẫu status đã kiểm chứng; unknown dùng nội dung trung tính.
- Không dùng UUID làm report ID, không lấy vài ký tự cuối ObjectId làm mã nghiệp vụ.
- 182 record cũ được kiểm tra bằng formatter, không record nào gây lỗi. Kiểm tra gateway với Officer thật trả 200/53 thông báo, không lộ mã kỹ thuật trong nội dung; tổng lịch sử vẫn 182.
- Các record AI cũ gửi sai `System` không được tự suy đoán chủ sở hữu hay chuyển sang broadcast. Thiếu provenance thì giữ nguyên lịch sử, không phát lại.

## Quyền truy cập và trạng thái đọc

- HTTP xác thực JWT độc lập ở Notification Service, không tin header tự gửi. PATCH/DELETE scope đúng user/role và notification ID; người ngoài nhận 404, chưa đăng nhập nhận 401.
- Citizen xem private + `system`; Officer thêm `officers`; Admin thêm `admins`, không nhận các nhiệm vụ chung của Officer.
- Private record giữ `isRead`; shared record tính theo `readBy[]` của từng user. Delete là dismiss theo `dismissedBy[]`, không xóa lịch sử hoặc ảnh hưởng người khác. Count/pagination dùng cùng scope.
- Flag `isRead` shared cũ không thể xác định ai từng đọc. Giữ nguyên flag trong DB nhưng không coi nó là bằng chứng mọi người đã đọc; từng người đọc lại một lần theo trạng thái riêng. Không có migration suy đoán lịch sử.
- Socket xác minh JWT HS256/expiry, room lấy từ claims; `join` do client gửi không cấp quyền. Logout/switch account mobile ngắt socket cũ. Web/mobile truyền token mới khi reconnect.
- Broadcast chung chỉ còn tín hiệu invalidation, không có ID/payload riêng tư. Update chi tiết chỉ gửi chủ báo cáo, Officer được giao và Admin; notification sau lưu chỉ gửi đúng recipient/role.
- Không thêm Expo Push infrastructure. Xác thực socket hiện kiểm tra chữ ký và thời hạn JWT; không bổ sung cơ chế thu hồi token tức thời riêng cho socket.

## Mobile

- Giữ Dark Civic/Stitch. Icon theo sự kiện, hoàn tất xanh, xử lý cyan, chờ amber, từ chối đỏ.
- Tiêu đề tối đa hai dòng; nội dung dài bốn dòng và có nút xem đầy đủ/thu gọn. Nội dung ngắn không bị cắt. Thời gian tiếng Việt, dấu chưa đọc, CTA khi có report ID thật.
- Giữ xác nhận xóa, mark read/all, refresh, pagination, loading/error/retry/empty, cache theo user và chống tap trùng.
- Citizen → AlertDetail; Officer → OfficerAlertDetail; Admin → AlertDetail trong Admin navigator hiện có. API báo cáo tiếp tục kiểm tra quyền. Không có entity ID thì không mở báo cáo; Citizen có thể ở trung tâm thông báo.

## Kiểm thử và triển khai

```powershell
cd backend/notification-service
npm run build
$env:NOTIFICATION_TEST_MONGO_URI='mongodb://127.0.0.1:27017'
$env:NOTIFICATION_TEST_AMQP_URL='amqp://127.0.0.1:5672'
npm test
```

Integration test dùng database tên ngẫu nhiên `ecoalert-notification-test-*` và queue AMQP exclusive riêng; không publish event thử vào exchange ứng dụng. Chỉ database thử được dọn khi xong.

```powershell
cd mobile
npx tsc --noEmit
node --test tests/*.test.cjs
```

Đã kiểm tra HTTP/JWT, Socket.IO thật, RabbitMQ thật, Mongo thật: recipients, dedup, chống giả room, private ownership, shared read/dismiss độc lập, legacy presentation, pagination/count.

Kết quả cuối: Notification Service build và 6/6 tests qua (gồm integration thật); mobile typecheck và 126/126 tests qua (có cả 4 tests của thay đổi Admin giữ riêng); Alert Service build và 42 tests qua, 2 integration tests khác skip vì chưa cấu hình môi trường riêng của chúng; AI Service build và 6/6 tests qua; frontend TypeScript/Vite production build qua; `git diff --check` qua.

Đã build và chạy lại `notification-service`, `alert-service`, `ai-service` bằng Compose `up -d --build --no-deps`; không down stack, không xóa volume. Các service healthy, gateway vẫn port 3000. Thêm `JWT_SECRET` vào environment của Notification Service để khớp gateway.

AI suite ban đầu chạy nhầm test image-validation trong `dist` từ ngày 26/09, source đã bị xóa. Chỉ dọn đúng hai artifact JS cũ (test/module), không sửa business logic; suite source hiện tại qua 6/6.

### Cần xác nhận trên điện thoại thật

- Độ thoáng card, Dynamic Type, chiều rộng iPhone khác nhau, nền sáng/tối.
- Tap foreground/background/cold start trên thiết bị từng role; logout/login thực tế; mạng yếu và reconnect khi token hết hạn.
- Push từ xa cần môi trường EAS/development build đang có; không coi test local notification là xác nhận remote push.
- Chưa chạy thao tác tạo–xử lý–đóng báo cáo bằng người dùng trên điện thoại thật. Test tích hợp xác nhận delivery/HTTP/socket, không thay thế kiểm thử toàn bộ workflow trên thiết bị.
- npm audit vẫn có cảnh báo dependencies hiện hữu; không chạy `audit fix --force` hoặc nâng cấp ngoài phạm vi.

## File thay đổi

- Notification Service: `package.json`, `package-lock.json`, `src/app.ts`, `src/routes/index.ts`, `src/models/notification.model.ts`, `src/repositories/notification.repository.ts`, `src/controllers/notification.controller.ts`, `src/services/{rabbitmq,notification,socket}.service.ts`, `src/utils/notification-{content,access}.ts`, `tests/notification-{links,integration}.test.cjs`.
- AI: `src/services/rabbitmq.service.ts`, `src/tests/rabbitmq.service.test.ts`.
- Alert: `src/services/alert.service.ts`, `src/services/rabbitmq.service.ts`, `src/tests/ai-analysis.test.ts`.
- Deploy/web: `docker-compose.yml`, `frontend/src/contexts/SocketContext.tsx`.
- Mobile: `src/context/SocketContext.tsx`, `src/navigation/{navigationRef,types}.ts`, `src/utils/notification{Navigation,Presentation}.ts`, `src/types/notification.ts`, `src/services/pushNotificationService.ts`, `src/screens/citizen/CitizenNotificationsScreen.tsx`, `tests/notifications.test.cjs`, `tests/notification-presentation.test.cjs`.
- Báo cáo này: `docs/vietnamese-notifications.md`.
