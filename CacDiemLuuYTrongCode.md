# Các điểm lưu ý trong code EcoAlert

Tài liệu này tổng hợp các vấn đề và điểm cần cải tiến được phát hiện khi đọc backend EcoAlert. Mục tiêu là dùng làm backlog kỹ thuật để sửa dần, tránh quên các rủi ro đang tồn tại.

> Trạng thái mặc định của các mục bên dưới là chưa xử lý. Khi hoàn thành, đổi `[ ]` thành `[x]` và ghi thêm ngày sửa, commit hoặc pull request liên quan.

## Quy ước mức độ ưu tiên

- **P0 – Nghiêm trọng:** Có thể gây lộ dữ liệu, vượt quyền hoặc làm sai nghiệp vụ cốt lõi. Nên sửa trước khi demo công khai hoặc triển khai thật.
- **P1 – Cao:** Có thể gây mất event, dữ liệu không đồng bộ hoặc lỗi khó phục hồi. Nên sửa trước production.
- **P2 – Trung bình:** Ảnh hưởng hiệu năng, khả năng bảo trì hoặc trải nghiệm nhưng chưa trực tiếp phá luồng chính.
- **P3 – Cải tiến:** Nợ kỹ thuật và cải tiến dài hạn.

---

## 1. Authentication và User Service

### [ ] P0 — Không ghi password vào log

**File liên quan:**

- [`backend/user-service/src/controllers/auth.controller.ts`](backend/user-service/src/controllers/auth.controller.ts)
- [`backend/user-service/src/services/auth.service.ts`](backend/user-service/src/services/auth.service.ts)

**Hiện trạng:**

- `AuthController.login()` đang log toàn bộ `req.body`, trong đó có thể chứa password.
- `AuthService.login()` còn debug log thông tin user.

**Tác động:** Password có thể xuất hiện trong terminal, log aggregator, ảnh chụp màn hình hoặc dữ liệu hỗ trợ kỹ thuật.

**Hướng sửa:**

- Xóa các `console.log` liên quan đến request login và user được tìm thấy.
- Nếu cần log, chỉ log request ID, kết quả thành công/thất bại và user ID sau khi xác thực; tuyệt đối không log credential hoặc token.

**Tiêu chí hoàn thành:** Không có password, access token hoặc refresh token xuất hiện trong log.

### [ ] P0 — Bắt buộc cấu hình JWT secret an toàn

**File liên quan:** [`backend/user-service/src/config/env.config.ts`](backend/user-service/src/config/env.config.ts)

**Hiện trạng:** User Service dùng fallback `supersecretjwtkey` khi thiếu `JWT_SECRET`.

**Tác động:** Môi trường triển khai sai cấu hình có thể phát hành JWT bằng secret dễ đoán.

**Hướng sửa:**

- Loại bỏ secret mặc định.
- Từ chối khởi động nếu thiếu `JWT_SECRET` hoặc secret không đạt độ dài tối thiểu.
- Bảo đảm Gateway và User Service dùng cùng một secret hoặc chuyển sang cơ chế ký bất đối xứng.

### [ ] P1 — Lưu hash của refresh token thay vì plaintext

**File liên quan:**

- [`backend/user-service/src/services/token.service.ts`](backend/user-service/src/services/token.service.ts)
- [`backend/user-service/src/repositories/refresh-token.repository.ts`](backend/user-service/src/repositories/refresh-token.repository.ts)
- [`backend/user-service/src/models/refresh-token.model.ts`](backend/user-service/src/models/refresh-token.model.ts)

**Hiện trạng:** Refresh token UUID được lưu nguyên văn trong MongoDB.

**Tác động:** Nếu database bị đọc trái phép, attacker có thể dùng trực tiếp token còn hạn.

**Hướng sửa:**

- Chỉ trả token gốc cho client một lần.
- Lưu SHA-256/HMAC của token trong database.
- Khi refresh/logout, hash token client gửi rồi tìm theo hash.
- Giữ cơ chế refresh-token rotation hiện có.

### [ ] P1 — Validate body của logout

**File liên quan:**

- [`backend/user-service/src/routes/auth.routes.ts`](backend/user-service/src/routes/auth.routes.ts)
- [`backend/user-service/src/dtos/auth.dto.ts`](backend/user-service/src/dtos/auth.dto.ts)

**Hiện trạng:** Route logout không có schema validation cho `refreshToken`.

**Hướng sửa:** Tạo `logoutSchema`, quy định `refreshToken` là string hợp lệ hoặc optional theo contract đã chọn, rồi thêm `validate(logoutSchema)` trước controller.

### [ ] P2 — Blacklist access token theo thời gian còn lại thực tế

**File liên quan:** [`backend/user-service/src/services/token.service.ts`](backend/user-service/src/services/token.service.ts)

**Hiện trạng:** TTL blacklist luôn bằng toàn bộ `JWT_EXPIRES_IN`, dù token có thể sắp hết hạn.

**Tác động:** Redis giữ key lâu hơn cần thiết.

**Hướng sửa:** Decode/verify trường `exp`, tính `max(exp - now, 1)` và dùng giá trị đó làm TTL.

### [ ] P1 — Không trả chi tiết lỗi nội bộ cho client

**File liên quan:** [`backend/user-service/src/middlewares/error-handler.middleware.ts`](backend/user-service/src/middlewares/error-handler.middleware.ts)

**Hiện trạng:** Nhánh lỗi không xác định có thể trả trực tiếp `err.message`.

**Tác động:** Có thể làm lộ tên collection, câu query, cấu hình hoặc chi tiết triển khai.

**Hướng sửa:** Log chi tiết ở server cùng request ID, nhưng chỉ trả thông báo `Internal Server Error` cho client trong production.

---

## 2. API Gateway và ranh giới tin cậy

### [ ] P0 — Không expose trực tiếp internal service ra internet

**File liên quan:**

- [`backend/api-gateway/src/server.ts`](backend/api-gateway/src/server.ts)
- [`docker-compose.yml`](docker-compose.yml)

**Hiện trạng:** Các service phía sau tin `x-user-id` và `x-user-role` do Gateway gắn, nhưng phần lớn không tự xác minh JWT.

**Tác động:** Nếu client truy cập trực tiếp internal service, nó có thể tự giả header nhận dạng.

**Hướng sửa:**

- Chỉ public port của API Gateway.
- Đặt các service còn lại trong private Docker/network/VPC.
- Xóa hoặc ghi đè mọi `x-user-*` header từ request bên ngoài tại Gateway.
- Có thể thêm chữ ký/internal token giữa Gateway và downstream service cho lớp phòng thủ bổ sung.

### [ ] P1 — Chuẩn hóa public-route matching

**File liên quan:** [`backend/api-gateway/src/server.ts`](backend/api-gateway/src/server.ts)

**Hiện trạng:** Public route được so sánh bằng exact string; trailing slash hoặc biến thể URL có thể không khớp.

**Hướng sửa:** Chuẩn hóa pathname trước khi so sánh hoặc cấu hình public route bằng router/middleware rõ ràng.

### [ ] P1 — Quyết định rõ fail-open hay fail-closed khi Redis lỗi

**File liên quan:** [`backend/api-gateway/src/server.ts`](backend/api-gateway/src/server.ts)

**Hiện trạng:** Khi không đọc được Redis blacklist, Gateway vẫn cho token JWT hợp lệ đi tiếp.

**Tác động:** Token đã logout có thể tạm thời sử dụng lại khi Redis gián đoạn.

**Hướng sửa:** Ghi rõ quyết định rủi ro; với API nhạy cảm có thể fail-closed hoặc dùng cơ chế session/token version thay thế.

---

## 3. Alert workflow và tính nhất quán sự kiện

### [ ] P1 — Tránh phát `alert.updated` hai lần ở `updateStatus()`

**File liên quan:** [`backend/alert-service/src/services/alert.service.ts`](backend/alert-service/src/services/alert.service.ts)

**Hiện trạng:** `updateStatus()` gọi `publishWorkflowEvent(EVENTS.ALERT_UPDATED, ...)`, trong khi `publishWorkflowEvent()` luôn phát thêm một event `ALERT_UPDATED` nữa.

**Tác động:** Consumer và mobile có thể xử lý cùng thay đổi hai lần, tạo notification hoặc request refresh thừa.

**Hướng sửa:**

- Tạo event cụ thể như `alert.verified` và `alert.rejected`; hoặc
- Cho helper bỏ qua event tổng quát khi `eventName === EVENTS.ALERT_UPDATED`.

### [ ] P1 — Áp dụng Transactional Outbox cho MongoDB và RabbitMQ

**File liên quan:**

- [`backend/alert-service/src/services/alert.service.ts`](backend/alert-service/src/services/alert.service.ts)
- [`backend/alert-service/src/services/rabbitmq.service.ts`](backend/alert-service/src/services/rabbitmq.service.ts)

**Hiện trạng:** Alert được cập nhật trong MongoDB trước, sau đó mới publish RabbitMQ.

**Tác động:** Nếu database thành công nhưng publish thất bại, Alert đã đổi trạng thái trong khi Notification/GIS không nhận event. Client retry còn có thể nhận conflict dù event đầu chưa từng được gửi.

**Hướng sửa:**

- Ghi Alert update và outbox record trong cùng transaction.
- Worker publish các outbox record chưa gửi.
- Đánh dấu event đã publish và retry có backoff.
- Consumer vẫn phải idempotent.

### [ ] P1 — Không tin trực tiếp kết quả image validation do client gửi

**File liên quan:**

- [`backend/alert-service/src/dtos/alert.dto.ts`](backend/alert-service/src/dtos/alert.dto.ts)
- [`backend/alert-service/src/services/alert.service.ts`](backend/alert-service/src/services/alert.service.ts)

**Hiện trạng:** `createAlert()` nhận `imageValidation` từ request body và dùng nó trong nghiệp vụ.

**Tác động:** Client có thể sửa confidence, decision, category hoặc model nếu không có cơ chế đối chiếu server-side.

**Hướng sửa:** Lưu kết quả validation server-side theo `analysisId`/`mediaId`; khi tạo Alert chỉ nhận ID tham chiếu và lấy kết quả đáng tin từ database/cache.

### [ ] P2 — Hoàn thiện idempotency cho tạo Alert

**File liên quan:** [`backend/alert-service/src/services/alert.service.ts`](backend/alert-service/src/services/alert.service.ts)

**Hiện trạng:** Chống trùng dựa trên cùng Citizen, title, description trong 10 giây. Khi trùng, controller vẫn trả HTTP 201.

**Hướng sửa:** Dùng idempotency key do client tạo, unique index server-side và trả response thể hiện rõ resource cũ hay mới.

### [ ] P2 — Đánh giá giới hạn của GPS evidence

**File liên quan:**

- [`backend/alert-service/src/services/alert.service.ts`](backend/alert-service/src/services/alert.service.ts)
- [`backend/alert-service/src/utils/geo-evidence.util.ts`](backend/alert-service/src/utils/geo-evidence.util.ts)

**Hiện trạng:** Server kiểm tra khoảng cách và `accuracyMeters` do thiết bị cung cấp, nhưng chưa chống giả mạo GPS.

**Hướng sửa:** Ghi rõ giới hạn trong nghiệp vụ; nếu cần mức tin cậy cao hơn, cân nhắc attestation, timestamp/media metadata và kiểm tra bất thường. Không biến cơ chế này thành theo dõi nền liên tục.

---

## 4. RabbitMQ và khả năng phục hồi

### [ ] P1 — Thêm Dead Letter Queue và chiến lược retry

**File liên quan:**

- [`backend/notification-service/src/services/rabbitmq.service.ts`](backend/notification-service/src/services/rabbitmq.service.ts)
- [`backend/gis-service/src/services/rabbitmq.service.ts`](backend/gis-service/src/services/rabbitmq.service.ts)
- [`backend/alert-service/src/services/rabbitmq.service.ts`](backend/alert-service/src/services/rabbitmq.service.ts)

**Hiện trạng:** Consumer gọi `nack(message, false, false)`. Message lỗi không requeue và có thể mất nếu queue không có dead-letter exchange.

**Hướng sửa:**

- Cấu hình DLX/DLQ.
- Retry lỗi tạm thời với backoff và giới hạn số lần.
- Đưa lỗi schema/permanent error thẳng vào DLQ.
- Bổ sung công cụ theo dõi và replay DLQ.

### [ ] P1 — Xử lý chính xác trạng thái kết nối RabbitMQ khi startup

**File liên quan:**

- [`backend/alert-service/src/services/rabbitmq.service.ts`](backend/alert-service/src/services/rabbitmq.service.ts)
- [`backend/notification-service/src/services/rabbitmq.service.ts`](backend/notification-service/src/services/rabbitmq.service.ts)
- [`backend/gis-service/src/services/rabbitmq.service.ts`](backend/gis-service/src/services/rabbitmq.service.ts)

**Hiện trạng:** `connect()` tự bắt lỗi và lên lịch reconnect, nên `await connect()` có thể hoàn thành dù chưa kết nối. HTTP server vẫn mở và publish có thể thất bại.

**Hướng sửa:** Phân biệt initial connection và reconnect; expose readiness check; chỉ báo ready khi channel thực sự hoạt động.

### [ ] P2 — Thêm publisher confirms

**File liên quan:** [`backend/alert-service/src/services/rabbitmq.service.ts`](backend/alert-service/src/services/rabbitmq.service.ts)

**Hiện trạng:** `channel.publish()` trả boolean về buffer/backpressure, không xác nhận broker đã nhận bền vững message.

**Hướng sửa:** Dùng confirm channel hoặc outbox publisher có confirm trước khi đánh dấu event đã gửi.

### [ ] P2 — Thiết lập prefetch phù hợp cho consumer

**File liên quan:**

- [`backend/notification-service/src/services/rabbitmq.service.ts`](backend/notification-service/src/services/rabbitmq.service.ts)
- [`backend/gis-service/src/services/rabbitmq.service.ts`](backend/gis-service/src/services/rabbitmq.service.ts)

**Hiện trạng:** Chưa cấu hình giới hạn số message chưa ack cho các consumer này.

**Hướng sửa:** Dùng `channel.prefetch(n)` phù hợp với tải và bảo đảm ordering cần thiết theo entity.

---

## 5. Notification Service và Socket.IO

### [ ] P0 — Xác thực JWT cho Socket.IO

**File liên quan:**

- [`backend/notification-service/src/services/socket.service.ts`](backend/notification-service/src/services/socket.service.ts)
- [`mobile/src/context/SocketContext.tsx`](mobile/src/context/SocketContext.tsx)

**Hiện trạng:** Client tự gửi `userId` và `role` qua event `join`; server tin trực tiếp dữ liệu này.

**Tác động:** Client có thể thử tham gia room của user khác hoặc room role cao hơn.

**Hướng sửa:**

- Mobile gửi access token trong Socket.IO handshake `auth`.
- Socket middleware verify token server-side.
- Server tự suy ra `userId` và `role`, rồi tự join room.
- Không nhận identity/role tùy ý từ event `join`.

### [ ] P0 — Không broadcast dữ liệu Alert cho mọi socket

**File liên quan:**

- [`backend/notification-service/src/services/rabbitmq.service.ts`](backend/notification-service/src/services/rabbitmq.service.ts)
- [`backend/notification-service/src/services/socket.service.ts`](backend/notification-service/src/services/socket.service.ts)

**Hiện trạng:** Nhiều event dùng `emitToAll()` với payload Alert.

**Tác động:** User có thể nhận dữ liệu của Alert mà REST API không cho phép họ xem.

**Hướng sửa:**

- Phát tới `user:<citizenId>`, `user:<assignedOfficerId>` và room Admin phù hợp.
- Với broadcast công khai, chỉ gửi event tối thiểu không chứa dữ liệu nhạy cảm.
- Kiểm tra quyền trước khi client fetch chi tiết qua REST API.

### [ ] P0 — Kiểm tra quyền sở hữu khi mark-read hoặc delete notification

**File liên quan:** [`backend/notification-service/src/controllers/notification.controller.ts`](backend/notification-service/src/controllers/notification.controller.ts)

**Hiện trạng:** `markAsRead()` và `deleteNotification()` chỉ tìm theo notification ID.

**Tác động:** User biết ID có thể sửa hoặc xóa notification của user khác.

**Hướng sửa:** Query phải bao gồm recipient hợp lệ của actor. Đối với notification nhóm, cần thiết kế receipt riêng thay vì sửa document dùng chung.

### [ ] P1 — Tách trạng thái đọc của notification nhóm theo từng user

**File liên quan:**

- [`backend/notification-service/src/models/notification.model.ts`](backend/notification-service/src/models/notification.model.ts)
- [`backend/notification-service/src/controllers/notification.controller.ts`](backend/notification-service/src/controllers/notification.controller.ts)

**Hiện trạng:** Notification `recipientId = officers` hoặc `admins` là một document dùng chung. Một người mark read sẽ làm nó được đọc đối với cả nhóm.

**Hướng sửa:**

- Tạo `NotificationReceipt(notificationId, userId, readAt, deletedAt)`; hoặc
- Fan-out thành notification riêng cho từng người nhận.

### [ ] P1 — Chuẩn hóa recipient `system`

**File liên quan:**

- [`backend/notification-service/src/services/rabbitmq.service.ts`](backend/notification-service/src/services/rabbitmq.service.ts)
- [`backend/notification-service/src/controllers/notification.controller.ts`](backend/notification-service/src/controllers/notification.controller.ts)

**Hiện trạng:** Có nơi dùng `System`, nơi khác query `system`. MongoDB so sánh string có phân biệt hoa thường.

**Hướng sửa:** Dùng constant/enum chung cho `system`, `officers`, `admins`; không viết literal rải rác.

### [ ] P1 — Thêm middleware authentication rõ ràng cho Notification REST routes

**File liên quan:** [`backend/notification-service/src/routes/index.ts`](backend/notification-service/src/routes/index.ts)

**Hiện trạng:** Controller đọc `x-user-id` nhưng router không có `requireAuth` riêng; hiện đang phụ thuộc hoàn toàn vào Gateway.

**Hướng sửa:** Thêm middleware kiểm tra header nội bộ/actor và giữ service trong private network.

### [ ] P2 — Dùng repository/service nhất quán trong controller

**File liên quan:**

- [`backend/notification-service/src/controllers/notification.controller.ts`](backend/notification-service/src/controllers/notification.controller.ts)
- [`backend/notification-service/src/repositories/notification.repository.ts`](backend/notification-service/src/repositories/notification.repository.ts)

**Hiện trạng:** Controller truy cập trực tiếp Mongoose model dù repository đã tồn tại.

**Hướng sửa:** Chuyển query sang repository/service để tập trung logic quyền, filter recipient và test dễ hơn.

### [ ] P2 — Giảm số lần mobile refetch khi nhận realtime event

**File liên quan:** [`mobile/src/context/SocketContext.tsx`](mobile/src/context/SocketContext.tsx)

**Hiện trạng:** Mobile nghe cả `realtime:event` và event cụ thể; mỗi listener gọi `invalidateQueries()` cho toàn bộ cache rồi `refetchQueries()`.

**Tác động:** Một thay đổi có thể gây nhiều request và tải lại dữ liệu không liên quan.

**Hướng sửa:**

- Chọn một contract realtime chính hoặc khử trùng theo `eventId`.
- Invalidate query cụ thể như `alerts`, `notifications`, `unread-count`.
- Cân nhắc cập nhật cache trực tiếp nếu payload đủ và đã được phân quyền.

---

## 6. Media Service và lưu trữ ảnh

### [ ] P0 — Kiểm tra nội dung file ảnh thật

**File liên quan:** [`backend/media-service/src/routes/upload.routes.ts`](backend/media-service/src/routes/upload.routes.ts)

**Hiện trạng:** Multer chỉ kiểm tra `file.mimetype.startsWith('image/')`, nhưng MIME type do client cung cấp.

**Tác động:** File không phải ảnh hoặc file độc hại có thể được upload với MIME giả.

**Hướng sửa:**

- Kiểm tra magic bytes/file signature.
- Decode ảnh bằng thư viện an toàn và reject file lỗi.
- Chỉ cho phép định dạng cụ thể như JPEG, PNG, WebP.
- Giới hạn pixel, kích thước file và cân nhắc re-encode ảnh.

### [ ] P1 — Hoàn thiện Media metadata hoặc bỏ MongoDB/model không dùng

**File liên quan:**

- [`backend/media-service/src/models/media.model.ts`](backend/media-service/src/models/media.model.ts)
- [`backend/media-service/src/controllers/upload.controller.ts`](backend/media-service/src/controllers/upload.controller.ts)
- [`backend/media-service/src/server.ts`](backend/media-service/src/server.ts)

**Hiện trạng:** `Media` model và MongoDB connection tồn tại nhưng upload không lưu document metadata.

**Hướng sửa:** Chọn một trong hai:

1. Lưu metadata `url`, storage key, MIME, size, checksum, uploadedBy và trạng thái liên kết; hoặc
2. Loại bỏ model/database nếu service chỉ làm stateless S3 proxy.

### [ ] P1 — Không giả định S3 object luôn public

**File liên quan:** [`backend/media-service/src/services/s3.service.ts`](backend/media-service/src/services/s3.service.ts)

**Hiện trạng:** URL được ghép thủ công sau upload và giả định client đọc được object.

**Hướng sửa:**

- Quyết định rõ public bucket, CloudFront hoặc private object với presigned URL.
- Lưu cả object key thay vì chỉ URL tuyệt đối.
- Không hard-code cách dựng URL nếu dùng endpoint/CDN khác.

### [ ] P1 — Xử lý ảnh mồ côi

**File liên quan:**

- [`backend/media-service/src/services/s3.service.ts`](backend/media-service/src/services/s3.service.ts)
- [`backend/alert-service/src/services/alert.service.ts`](backend/alert-service/src/services/alert.service.ts)

**Hiện trạng:** Upload có thể thành công nhưng tạo Alert thất bại hoặc user bỏ form, để lại object không được tham chiếu.

**Hướng sửa:** Upload ở trạng thái temporary, xác nhận liên kết khi tạo Alert thành công, và có scheduled cleanup cho object quá hạn chưa được liên kết.

### [ ] P1 — Không tin extension từ tên file gốc

**File liên quan:** [`backend/media-service/src/services/s3.service.ts`](backend/media-service/src/services/s3.service.ts)

**Hiện trạng:** Extension S3 key được lấy từ `file.originalname`.

**Hướng sửa:** Xác định extension từ loại file đã kiểm tra; chuẩn hóa tên và không dùng dữ liệu tên file để quyết định định dạng.

### [ ] P2 — Xóa cấu hình Cloudinary nếu không dùng

**File liên quan:** [`backend/media-service/src/config/cloudinary.config.ts`](backend/media-service/src/config/cloudinary.config.ts)

**Hiện trạng:** Có cấu hình Cloudinary nhưng luồng upload hiện tại dùng AWS S3.

**Hướng sửa:** Chọn một provider rõ ràng hoặc trừu tượng hóa storage provider nếu thật sự cần hỗ trợ cả hai.

### [ ] P2 — Giới hạn tài nguyên upload đồng thời

**File liên quan:** [`backend/media-service/src/routes/upload.routes.ts`](backend/media-service/src/routes/upload.routes.ts)

**Hiện trạng:** Multer dùng memory storage; mỗi file tối đa 10 MB nhưng chưa có rate/concurrency limit riêng cho upload.

**Hướng sửa:** Thêm rate limit cho upload, giới hạn concurrency và theo dõi memory; cân nhắc stream trực tiếp tới object storage.

---

## 7. GIS Service và Weather

### [ ] P1 — Không nuốt lỗi trong `saveLocation()`

**File liên quan:**

- [`backend/gis-service/src/services/gis.service.ts`](backend/gis-service/src/services/gis.service.ts)
- [`backend/gis-service/src/services/rabbitmq.service.ts`](backend/gis-service/src/services/rabbitmq.service.ts)

**Hiện trạng:** `saveLocation()` bắt lỗi và chỉ log, sau đó consumer vẫn `ack` message.

**Tác động:** GIS read model có thể thiếu/sai dữ liệu mà event không được retry hoặc đưa vào DLQ.

**Hướng sửa:** Log context rồi throw lại; consumer quyết định retry/DLQ. Bảo đảm operation idempotent theo `alertId`.

### [ ] P1 — Tạo event schema chặt chẽ cho GIS

**File liên quan:** [`backend/gis-service/src/services/rabbitmq.service.ts`](backend/gis-service/src/services/rabbitmq.service.ts)

**Hiện trạng:** Event và `alertData` dùng `any`; `saveLocation()` giả định payload có `_id` và `location`.

**Hướng sửa:**

- Định nghĩa shared DTO/event version.
- Validate runtime bằng Zod trước khi ghi database.
- Chuẩn hóa dùng `alertId` hay `_id`, không hỗ trợ ngầm nhiều dạng không rõ ràng.

### [ ] P1 — Phân biệt dữ liệu thời tiết thật và mock

**File liên quan:** [`backend/gis-service/src/services/weather.service.ts`](backend/gis-service/src/services/weather.service.ts)

**Hiện trạng:** Thiếu API key hoặc provider lỗi thì service trả dữ liệu mock trông giống dữ liệu thật.

**Tác động:** Người dùng có thể hiểu nhầm thông tin thời tiết/AQI giả là dữ liệu hiện tại.

**Hướng sửa:**

- Production nên trả `503` hoặc response có `source: "mock" | "provider"` và `isFallback: true`.
- UI phải hiển thị rõ dữ liệu mẫu/không khả dụng.
- Chỉ dùng mock trong development/test.

### [ ] P1 — Validate và giới hạn bán kính truy vấn GIS

**File liên quan:** [`backend/gis-service/src/controllers/gis.controller.ts`](backend/gis-service/src/controllers/gis.controller.ts)

**Hiện trạng:** `getNearby()` và `getRadius()` kiểm tra tọa độ chưa đầy đủ và chưa giới hạn khoảng cách tối đa chặt như drill-down.

**Hướng sửa:**

- Dùng chung `parseCoordinates()`.
- Kiểm tra distance/radius là số hữu hạn và dương.
- Đặt maximum hợp lý.
- Không dùng `|| default` để biến giá trị `0`, âm hoặc `NaN` thành default mà không báo lỗi.

### [ ] P2 — Cân nhắc cơ chế rebuild GIS read model

**File liên quan:**

- [`backend/gis-service/src/models/location.model.ts`](backend/gis-service/src/models/location.model.ts)
- [`backend/gis-service/src/services/gis.service.ts`](backend/gis-service/src/services/gis.service.ts)

**Hiện trạng:** GIS phụ thuộc event để giữ bản sao dữ liệu. Event bị mất có thể làm read model lệch khỏi Alert database.

**Hướng sửa:** Có job reconciliation/rebuild từ Alert source of truth, hoặc cung cấp event log có thể replay.

### [ ] P2 — Kiểm tra semantics của thời gian filter heatmap

**File liên quan:** [`backend/gis-service/src/services/gis.service.ts`](backend/gis-service/src/services/gis.service.ts)

**Hiện trạng:** Heatmap lọc theo `Location.createdAt`, là thời điểm read model được tạo, có thể lệch thời điểm Alert gốc được báo cáo sau rebuild/import.

**Hướng sửa:** Đồng bộ `alertCreatedAt` rõ ràng từ Alert event và lọc theo field đó.

---

## 8. Những điểm thiết kế tốt nên giữ

- [ ] Citizen ID được lấy từ identity do Gateway xác minh, không tin `citizenId` trong request body.
- [ ] Role và quyền nghiệp vụ được kiểm tra lại ở tầng service.
- [ ] Alert workflow dùng conditional atomic update để hạn chế race condition.
- [ ] Password dùng bcrypt và field `password` có `select: false`.
- [ ] Refresh token có rotation; token cũ bị xóa sau khi dùng.
- [ ] Notification có idempotency theo cặp `{ recipientId, eventId }`.
- [ ] GeoJSON dùng đúng thứ tự `[longitude, latitude]`.
- [ ] GPS check-in kiểm tra accuracy và khoảng cách ở server.
- [ ] Officer chỉ xử lý Alert được giao cho chính mình.
- [ ] Admin phải review kết quả trước khi đóng Alert.
- [ ] AI không tự xác minh, phân công, resolve hoặc đóng Alert.
- [ ] GIS dùng read model và `2dsphere` index cho truy vấn không gian.
- [ ] Weather provider response được kiểm tra runtime trước khi sử dụng.

Các checkbox trong phần này là nguyên tắc cần bảo toàn khi refactor, không phải lỗi cần sửa.

---

## 8A. Kiểm thử

### [ ] P1 — Thêm HTTP/integration test cho các endpoint và middleware

**File liên quan:** [`backend/alert-service/src/tests`](backend/alert-service/src/tests)

**Hiện trạng:** Test Alert Service hiện chủ yếu gọi thẳng service/helper. Chưa kiểm tra đầy đủ chuỗi route, validation middleware, controller, response status/body và error handler.

**Hướng sửa:** Bổ sung integration test với HTTP test client và database test cô lập; kiểm tra ít nhất authentication header, Zod validation, status code, response contract và quyền truy cập theo role.

### [ ] P2 — Không monkey-patch singleton dùng chung khi test có thể chạy song song

**File liên quan:**

- [`backend/alert-service/src/tests/workflow-authorization.test.ts`](backend/alert-service/src/tests/workflow-authorization.test.ts)
- [`backend/alert-service/src/tests/ai-analysis.test.ts`](backend/alert-service/src/tests/ai-analysis.test.ts)

**Hiện trạng:** Test thay trực tiếp method của `alertRepository` và `rabbitMQService`, rồi phục hồi trong `finally`.

**Tác động:** Test có thể ảnh hưởng lẫn nhau khi runner chạy đồng thời; lỗi giữa chừng hoặc test mới quên restore sẽ làm kết quả không ổn định.

**Hướng sửa:** Inject repository/publisher vào service, dùng mock instance riêng cho từng test, hoặc bắt buộc nhóm test có shared singleton chạy tuần tự.

### [ ] P2 — Kiểm tra đúng loại lỗi và message trong negative test

**File liên quan:** [`backend/alert-service/src/tests/workflow-authorization.test.ts`](backend/alert-service/src/tests/workflow-authorization.test.ts)

**Hiện trạng:** Một số `assert.rejects(...)` chỉ kiểm tra rằng có lỗi, nên test vẫn pass nếu function throw nhầm lỗi.

**Hướng sửa:** Kiểm tra class/status/message mong đợi, ví dụ phân biệt `ForbiddenError`, `ConflictError` và `NotFoundError`.

---

## 9. Thứ tự sửa đề xuất

### Giai đoạn 1 — Trước demo công khai

1. Xóa password/token khỏi log.
2. Bắt buộc JWT secret.
3. Xác thực Socket.IO và không cho client tự khai role/user ID.
4. Ngừng broadcast payload Alert cho mọi socket.
5. Kiểm tra quyền sở hữu notification.
6. Kiểm tra nội dung ảnh thật.

### Giai đoạn 2 — Trước production

1. Transactional outbox cho Alert events.
2. DLQ, retry và readiness cho RabbitMQ.
3. Hash refresh token.
4. Sửa notification nhóm và trạng thái đọc theo user.
5. Chuẩn hóa event contract cho GIS.
6. Xử lý ảnh tạm/mồ côi và chiến lược truy cập S3.
7. Phân biệt rõ weather provider và mock fallback.

### Giai đoạn 3 — Tối ưu và bảo trì

1. Giảm mobile cache invalidation.
2. Hoàn thiện idempotency key cho tạo Alert.
3. Reconciliation/rebuild GIS read model.
4. Dọn code/config/model không sử dụng.
5. Thêm metrics, tracing, alerting và công cụ replay event.

---

## 10. Mẫu ghi nhận khi sửa

Khi xử lý một mục, có thể bổ sung ngay dưới mục đó:

```md
**Đã xử lý:** 2026-xx-xx  
**Commit/PR:** `<commit hoặc đường dẫn PR>`  
**Cách sửa:** Mô tả ngắn giải pháp đã áp dụng.  
**Kiểm thử:** Liệt kê test hoặc bước xác minh đã chạy.
```

Nên bổ sung test hồi quy cho mỗi lỗi bảo mật, phân quyền, idempotency hoặc event consistency trước khi đánh dấu hoàn thành.
