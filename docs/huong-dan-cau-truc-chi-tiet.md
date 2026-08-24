# Hướng dẫn cấu trúc chi tiết dự án EcoAlert

> Phạm vi: tài liệu này mô tả từng **tệp nguồn, cấu hình, kiểm thử và tài liệu do nhóm quản lý**. Không liệt kê từng tệp trong `node_modules`, `dist`, ảnh/nhãn YOLO và bundle build vì chúng được sinh tự động hoặc gồm hàng nghìn tệp; các nhóm đó được giải thích riêng ở cuối.

## 1. Thư mục gốc

| Tệp/thư mục | Vai trò |
|---|---|
| `.git/` | Metadata của Git: lịch sử, nhánh và trạng thái phiên bản. Không chỉnh tay. |
| `.env` | Biến môi trường dùng khi chạy Docker, như chuỗi kết nối DB và khóa bí mật. Không đưa vào Git hoặc tài liệu công khai. |
| `.gitignore` | Quy định các tệp không được Git theo dõi: dependency, build output, `.env`, dataset và model. |
| `docker-compose.yml` | Khởi chạy toàn bộ stack: MongoDB, Redis, RabbitMQ, API Gateway, sáu Node service và Vision service. |
| `docker-compose.infrastructure.yml` | Khởi chạy riêng ba hạ tầng cục bộ: MongoDB, Redis và RabbitMQ. Phù hợp khi chạy service bằng `npm run dev`. |
| `CacDiemLuuYTrongCode.md` | Danh sách rủi ro/điểm cần cải thiện về bảo mật, event, media, GIS và test. |
| `tree.txt` | Ảnh chụp cây thư mục cũ, rất lớn; chỉ tham khảo, không phải mã nguồn thực thi. |
| `backend/` | Mã backend theo kiến trúc microservices. |
| `frontend/` | Ứng dụng web React/Vite. |
| `mobile/` | Ứng dụng Expo/React Native. |
| `datasets/` | Dữ liệu huấn luyện/đánh giá YOLO. |
| `models/` | Artifact mô hình đã huấn luyện. |
| `docs/` | Tài liệu kiến trúc, nghiệp vụ và AI. |

### 1.1. Các tệp trong `docs/`

| Tệp | Vai trò |
|---|---|
| `ai-assistant.md` | Contract, phạm vi dữ liệu và hành vi của chatbot EcoAlert. |
| `ai-overall-incident-analysis.md` | Quy tắc phân tích đa phương thức: Vision, LLM, fusion, category và confidence. |
| `custom-yolo-deployment.md` | Hướng dẫn đóng gói/cấu hình/trình tự triển khai custom YOLO. |
| `ecoalert-waste-dataset-guide.md` | Nguồn gốc, cấu trúc và quy ước sử dụng dataset rác. |
| `p0-core-incident-workflow.md` | Đặc tả workflow cốt lõi từ citizen report đến Admin đóng sự cố. |
| `p1-operational-management.md` | Đặc tả các chức năng vận hành/quản trị giai đoạn P1. |
| `phase-1-vision-ai.md` | Kế hoạch/tài liệu giai đoạn tích hợp AI Vision ban đầu. |
| `phase-1-multimodal-vision.md` | Tài liệu mở rộng Vision theo hướng đa phương thức. |
| `phase-1a-multimodal-vision.md` | Contract triển khai Phase 1A cho custom YOLO, bảo mật và đánh giá. |
| `notebooks/ecoalert-yolo26-training.ipynb` | Notebook tương tác để khám phá/huấn luyện YOLO. |
| `ai-evaluation/README.md` | Hướng dẫn quy trình đánh giá chất lượng AI/Vision. |
| `ai-evaluation/vision-evaluation-template.csv` | Biểu mẫu ghi nhận mẫu test, dự đoán và kết quả đánh giá Vision. |

## 2. `backend/` — microservices

### 2.1. Tệp dùng chung ở `backend/`

| Tệp | Vai trò |
|---|---|
| `Dockerfile` | Build đa tầng cho các Node service: build `shared` trước, sau đó build service được truyền qua `SERVICE_NAME`. |
| `package.json` | Package gốc, cung cấp lệnh `seed` để nạp dữ liệu mẫu. |
| `seed.ts` | Xóa và tạo dữ liệu demo cho database User, Alert và GIS. Chỉ dùng ở môi trường phát triển/demo. |
| `start-dev.ps1` | Script PowerShell hỗ trợ khởi động môi trường backend cục bộ. |

### 2.2. Quy ước chung trong các Node service

| Vị trí | Ý nghĩa |
|---|---|
| `src/app.ts` | Khởi tạo Express, middleware và route của service. |
| `src/server.ts` | Điểm khởi động HTTP server và kết nối các dependency cần thiết. |
| `src/config/` | Đọc/kiểm tra biến môi trường và kết nối database/cache. |
| `src/models/` | Schema Mongoose đại diện dữ liệu MongoDB. |
| `src/repositories/` | Đóng gói thao tác truy vấn database. |
| `src/services/` | Nghiệp vụ chính và gọi hệ thống ngoài. |
| `src/controllers/` | Chuyển HTTP request thành lời gọi service rồi trả response. |
| `src/routes/` | Khai báo endpoint HTTP và middleware áp dụng cho endpoint. |
| `src/middlewares/` | Xác thực, kiểm tra input và chuẩn hóa lỗi. |
| `src/dtos/` | Kiểu/contract dữ liệu vào-ra API. |
| `src/tests/` | Test tự động cho logic quan trọng. |
| `dist/` | JavaScript biên dịch từ TypeScript; Docker Compose có thể mount để chạy nhanh. Không sửa trực tiếp. |
| `package.json`, `tsconfig.json` | Dependency/lệnh build và cấu hình TypeScript của service. |

### 2.3. `backend/api-gateway/`

| Tệp | Vai trò |
|---|---|
| `src/server.ts` | Cổng vào công khai: cấu hình CORS, Helmet, rate-limit, kiểm tra JWT/Redis và proxy request đến các service nội bộ. |
| `package.json` | Khai báo Express, proxy middleware, JWT, Redis và lệnh dev/build/start. |
| `tsconfig.json` | Cấu hình biên dịch TypeScript của gateway. |

### 2.4. `backend/shared/`

| Tệp | Vai trò |
|---|---|
| `src/index.ts` | Điểm export chính của package `@ecoalert/shared`. |
| `src/constants/event-names.constant.ts` | Tên event liên service/RabbitMQ thống nhất. |
| `src/constants/http-status.constant.ts` | Hằng số mã trạng thái HTTP. |
| `src/constants/index.ts` | Gom export constants. |
| `src/dtos/api-response.dto.ts` | Cấu trúc phản hồi API chuẩn. |
| `src/dtos/pagination.dto.ts` | Kiểu dữ liệu phân trang. |
| `src/dtos/index.ts` | Gom export DTO. |
| `src/enums/alert-category.enum.ts` | Các danh mục sự cố môi trường chuẩn. |
| `src/enums/alert-status.enum.ts` | Trạng thái workflow: pending, verified, assigned, in-progress, resolved, closed. |
| `src/enums/media-type.enum.ts` | Phân loại media/bằng chứng. |
| `src/enums/notification-status.enum.ts` | Trạng thái đã/chưa đọc của thông báo. |
| `src/enums/notification-type.enum.ts` | Các loại thông báo nghiệp vụ. |
| `src/enums/severity.enum.ts` | Mức độ nghiêm trọng của sự cố. |
| `src/enums/user-role.enum.ts` | Các vai trò Citizen, Officer và Admin. |
| `src/enums/index.ts` | Gom export enum. |
| `src/errors/app-error.ts` | Lớp lỗi nghiệp vụ cơ sở. |
| `src/errors/bad-request.error.ts` | Lỗi HTTP 400. |
| `src/errors/unauthorized.error.ts` | Lỗi HTTP 401. |
| `src/errors/forbidden.error.ts` | Lỗi HTTP 403. |
| `src/errors/not-found.error.ts` | Lỗi HTTP 404. |
| `src/errors/conflict.error.ts` | Lỗi HTTP 409. |
| `src/errors/validation.error.ts` | Lỗi dữ liệu đầu vào không hợp lệ. |
| `src/errors/index.ts` | Gom export lớp lỗi. |
| `src/interfaces/ai-analysis.interface.ts` | Contract cho kết quả phân tích AI. |
| `src/interfaces/base-document.interface.ts` | Trường chung của document MongoDB. |
| `src/interfaces/base-repository.interface.ts` | Contract chung cho repository. |
| `src/interfaces/event-message.interface.ts` | Cấu trúc message event liên service. |
| `src/interfaces/user-payload.interface.ts` | Dữ liệu người dùng được gắn vào request/JWT. |
| `src/interfaces/index.ts` | Gom export interface. |
| `src/types/common.types.ts` | Các type tiện ích dùng chung. |
| `src/types/index.ts` | Gom export type. |
| `src/utils/ai-confidence.util.ts` | Chuẩn hóa/chọn confidence AI để hiển thị nhất quán. |
| `src/utils/api-response.util.ts` | Tạo response thành công/lỗi theo format chuẩn. |
| `src/utils/async-handler.util.ts` | Bao controller async để lỗi được chuyển cho error handler. |
| `src/utils/logger.util.ts` | Tiện ích ghi log. |
| `src/utils/index.ts` | Gom export utility. |
| `package.json`, `tsconfig.json` | Cấu hình package shared và TypeScript. |

### 2.5. `backend/user-service/`

| Tệp | Vai trò |
|---|---|
| `src/config/env.config.ts` | Đọc biến môi trường User service. |
| `src/config/database.config.ts` | Kết nối MongoDB của User service. |
| `src/config/redis.config.ts` | Kết nối Redis, chủ yếu phục vụ quản lý token/cache. |
| `src/config/index.ts` | Gom export cấu hình. |
| `src/models/base.model.ts` | Quy tắc schema chung: timestamps, soft delete và audit fields. |
| `src/models/user.model.ts` | Schema tài khoản, hồ sơ, role và trạng thái hoạt động. |
| `src/models/refresh-token.model.ts` | Schema refresh token/phiên đăng nhập. |
| `src/models/audit-log.model.ts` | Schema nhật ký thao tác người dùng/quản trị. |
| `src/repositories/user.repository.ts` | Truy vấn User. |
| `src/repositories/refresh-token.repository.ts` | Truy vấn và thu hồi refresh token. |
| `src/dtos/auth.dto.ts` | Validate/định nghĩa dữ liệu đăng ký, login, refresh, logout. |
| `src/dtos/user.dto.ts` | Contract tạo/sửa hồ sơ người dùng. |
| `src/utils/password.util.ts` | Hash và so sánh mật khẩu bằng bcrypt. |
| `src/utils/jwt.util.ts` | Ký, xác minh và giải mã JWT. |
| `src/services/auth.service.ts` | Nghiệp vụ đăng ký, đăng nhập, refresh và logout. |
| `src/services/token.service.ts` | Quản lý vòng đời access/refresh token. |
| `src/services/user.service.ts` | Nghiệp vụ hồ sơ, danh sách và cập nhật user. |
| `src/services/audit-log.service.ts` | Ghi/đọc audit log. |
| `src/controllers/auth.controller.ts` | HTTP handler cho authentication. |
| `src/controllers/user.controller.ts` | HTTP handler cho quản lý user. |
| `src/routes/auth.routes.ts` | Endpoint auth công khai. |
| `src/routes/user.routes.ts` | Endpoint người dùng và quản trị người dùng. |
| `src/routes/index.ts` | Ghép các route của User service. |
| `src/middlewares/auth.middleware.ts` | Xác minh access token và phân quyền role. |
| `src/middlewares/validate.middleware.ts` | Validate body/query/params. |
| `src/middlewares/error-handler.middleware.ts` | Chuẩn hóa response lỗi. |
| `src/app.ts`, `src/server.ts` | Tạo Express app và chạy server. |
| `index.js` | Điểm vào JavaScript cũ/khả năng tương thích; mã chính là TypeScript trong `src/`. |
| `package.json`, `tsconfig.json` | Dependency và cấu hình build. |

### 2.6. `backend/alert-service/`

| Tệp | Vai trò |
|---|---|
| `src/config/env.config.ts`, `database.config.ts` | Đọc cấu hình và kết nối MongoDB Alert. |
| `src/models/base.model.ts` | Base schema với audit/soft-delete. |
| `src/models/alert.model.ts` | Schema báo cáo: mô tả, vị trí, ảnh, workflow, evidence và dữ liệu AI. |
| `src/models/category.model.ts` | Schema danh mục sự cố có thể quản trị. |
| `src/models/officer-shift.model.ts` | Schema ca trực/khả dụng và workload của Officer. |
| `src/repositories/alert.repository.ts` | Truy vấn Alert, lọc, phân trang và cập nhật dữ liệu. |
| `src/dtos/alert.dto.ts` | Contract tạo/sửa alert, đổi trạng thái, check-in, resolve/close. |
| `src/utils/geo-evidence.util.ts` | Tính khoảng cách GPS, kiểm tra check-in và evidence có ở hiện trường. |
| `src/services/alert.service.ts` | Nghiệp vụ lõi: tạo, xác minh, phân công, xử lý, hoàn tất và đóng sự cố. |
| `src/services/category.service.ts` | Quản trị danh mục sự cố. |
| `src/services/officer-shift.service.ts` | Quản lý ca trực và năng lực xử lý của cán bộ. |
| `src/services/user-directory.service.ts` | Gọi User service để kiểm tra/lấy thông tin Citizen và Officer. |
| `src/services/rabbitmq.service.ts` | Phát event workflow cho GIS, AI và Notification service. |
| `src/controllers/alert.controller.ts` | Endpoint của báo cáo/sự cố. |
| `src/controllers/category.controller.ts` | Endpoint danh mục. |
| `src/routes/index.ts` | Ghép route Alert và Category. |
| `src/middlewares/validate.middleware.ts`, `error-handler.middleware.ts` | Validate input và chuẩn hóa lỗi. |
| `src/tests/ai-analysis.test.ts` | Test lưu/hiển thị kết quả AI trong Alert. |
| `src/tests/geo-evidence.test.ts` | Test kiểm tra GPS, khoảng cách và evidence hiện trường. |
| `src/tests/officer-shift-workload.test.ts` | Test logic ca trực và ngưỡng workload. |
| `src/tests/workflow-authorization.test.ts` | Test quyền chuyển trạng thái theo Citizen/Officer/Admin. |
| `src/app.ts`, `src/server.ts`, `package.json`, `tsconfig.json` | Bootstrap và cấu hình build service. |

### 2.7. `backend/media-service/`

| Tệp | Vai trò |
|---|---|
| `.env.example` | Mẫu biến môi trường cần thiết cho upload/storage. |
| `src/config/database.config.ts` | Kết nối MongoDB Media. |
| `src/config/cloudinary.config.ts` | Cấu hình Cloudinary còn tồn tại; hệ thống hiện có `s3.service.ts` cho S3. |
| `src/models/media.model.ts` | Schema metadata ảnh/tệp đã upload. |
| `src/services/s3.service.ts` | Upload đối tượng media lên AWS S3. |
| `src/controllers/upload.controller.ts` | Nhận multipart upload và trả URL/metadata. |
| `src/routes/upload.routes.ts` | Endpoint upload. |
| `src/middlewares/error-handler.middleware.ts` | Chuẩn hóa lỗi upload/storage. |
| `src/app.ts`, `src/server.ts`, `package.json`, `tsconfig.json` | Bootstrap và cấu hình build service. |

### 2.8. `backend/gis-service/`

| Tệp | Vai trò |
|---|---|
| `src/config/env.config.ts`, `database.config.ts` | Cấu hình và kết nối MongoDB GIS. |
| `src/models/location.model.ts` | Read model vị trí/sự cố dùng cho truy vấn bản đồ. |
| `src/services/gis.service.ts` | Lưu, cập nhật và truy vấn điểm sự cố/heatmap. |
| `src/services/rabbitmq.service.ts` | Nhận event Alert để đồng bộ GIS read model. |
| `src/services/weather.service.ts` | Cung cấp dữ liệu thời tiết cho client. |
| `src/services/weather-normalization.ts` | Chuẩn hóa dữ liệu thời tiết sang format ứng dụng dùng. |
| `src/controllers/gis.controller.ts` | Endpoint map, density/heatmap, weather. |
| `src/routes/index.ts` | Ghép endpoint GIS. |
| `src/middlewares/error-handler.middleware.ts` | Chuẩn hóa lỗi. |
| `src/tests/incident-density.test.ts` | Test cách tính mật độ sự cố. |
| `src/tests/weather-normalization.test.ts` | Test chuyển đổi dữ liệu thời tiết. |
| `src/app.ts`, `src/server.ts`, `package.json`, `tsconfig.json` | Bootstrap và cấu hình build service. |

### 2.9. `backend/notification-service/`

| Tệp | Vai trò |
|---|---|
| `src/config/env.config.ts` | Đọc cấu hình port, MongoDB, RabbitMQ và Socket. |
| `src/models/notification.model.ts` | Schema thông báo, người nhận và trạng thái đọc. |
| `src/repositories/notification.repository.ts` | Truy vấn/lưu thông báo. |
| `src/services/rabbitmq.service.ts` | Nhận event từ các service khác. |
| `src/services/notification.service.ts` | Tạo thông báo theo event và nghiệp vụ. |
| `src/services/socket.service.ts` | Cấu hình Socket.IO, phát cập nhật real-time cho client. |
| `src/controllers/notification.controller.ts` | Endpoint xem, đánh dấu đã đọc và xóa thông báo. |
| `src/routes/index.ts` | Khai báo route notification. |
| `src/app.ts`, `src/server.ts`, `package.json`, `tsconfig.json` | Bootstrap và cấu hình build service. |

### 2.10. `backend/ai-service/`

| Tệp | Vai trò |
|---|---|
| `.env.example` | Mẫu cấu hình OpenRouter, Redis, Vision và rate limit. |
| `src/config/env.config.ts` | Đọc/validate biến môi trường AI. |
| `src/config/database.config.ts` | Kết nối MongoDB AI và dữ liệu Alert cần đọc. |
| `src/config/openrouter.config.ts` | Khởi tạo client/cấu hình model OpenRouter. |
| `src/models/conversation.model.ts` | Schema phiên hội thoại chatbot. |
| `src/models/assistant-message.model.ts` | Schema từng tin nhắn trợ lý. |
| `src/models/alert-read.model.ts` | Read model Alert phục vụ AI/assistant. |
| `src/assistant/types.ts` | Kiểu dữ liệu cho intent, tool và message của assistant. |
| `src/assistant/knowledge.ts` | Tri thức/quy tắc nền cho chatbot EcoAlert. |
| `src/assistant/intent-detector.ts` | Nhận diện ý định người dùng trước khi chọn công cụ. |
| `src/assistant/tool-registry.ts` | Danh sách công cụ assistant được phép dùng. |
| `src/assistant/authorized-data.retriever.ts` | Lấy dữ liệu theo quyền của user, tránh chatbot thấy dữ liệu ngoài phạm vi. |
| `src/assistant/llm-provider.ts` | Lớp trừu tượng gọi nhà cung cấp LLM. |
| `src/services/openrouter.service.ts` | Gọi LLM để đánh giá ảnh, phân tích sự cố và trả lời chat. |
| `src/services/image-validation.service.ts` | Xác minh ảnh có liên quan báo cáo môi trường hay không. |
| `src/services/category-normalizer.service.ts` | Chuẩn hóa tên danh mục AI trả về sang enum EcoAlert. |
| `src/services/vision-client.service.ts` | Gọi Vision service nội bộ. |
| `src/services/vision-evidence.service.ts` | Biến output YOLO thành evidence gọn, an toàn để dùng tiếp. |
| `src/services/vision-fusion.service.ts` | Hợp nhất evidence YOLO với phân tích ngữ nghĩa; không để Vision tự quyết category. |
| `src/services/multimodal-analysis.service.ts` | Điều phối chuỗi Vision → AI semantic → fusion. |
| `src/services/ai-task-router.ts` | Điều hướng task AI theo loại event/request. |
| `src/services/rabbitmq.service.ts` | Nhận/phát event AI liên service. |
| `src/services/redis.service.ts` | Hỗ trợ rate limit/cache dữ liệu AI. |
| `src/services/assistant.service.ts` | Nghiệp vụ hội thoại, tool calling và lưu lịch sử. |
| `src/middlewares/assistant-auth.middleware.ts` | Xác thực/phân quyền request chat assistant. |
| `src/controllers/assistant.controller.ts` | HTTP handler cho chat và các chức năng AI. |
| `src/routes/assistant.routes.ts` | Endpoint của assistant. |
| `src/tests/assistant-rag.test.ts` | Test truy xuất dữ liệu có kiểm soát quyền. |
| `src/tests/confidence-resolution.test.ts` | Test quy tắc chọn confidence cuối cùng. |
| `src/tests/image-validation.service.test.ts` | Test kết quả validate ảnh. |
| `src/tests/multimodal-analysis.service.test.ts` | Test luồng Vision + LLM. |
| `src/tests/openrouter.service.test.ts` | Test lớp gọi OpenRouter. |
| `src/tests/overall-incident-analysis.test.ts` | Test format/ý nghĩa phân tích tổng quan. |
| `src/tests/rabbitmq.service.test.ts` | Test xử lý event AI. |
| `src/tests/vision-client.service.test.ts` | Test client gọi Vision service. |
| `src/tests/vision-fusion.service.test.ts` | Test hợp nhất bằng chứng Vision. |
| `src/app.ts`, `src/server.ts`, `package.json`, `tsconfig.json` | Bootstrap và cấu hình build service. |

### 2.11. `backend/vision-service/` — Python/FastAPI

| Tệp | Vai trò |
|---|---|
| `.env.example` | Mẫu token nội bộ, đường dẫn model, giới hạn ảnh và ngưỡng YOLO. |
| `Dockerfile` | Image Python tách dependency build/runtime cho Vision service. |
| `requirements.txt` | Dependency chạy production như FastAPI, Ultralytics/PyTorch. |
| `requirements-dev.txt` | Dependency phát triển/kiểm thử. |
| `README.md` | Mô tả contract triển khai Vision service. |
| `app/__init__.py` | Đánh dấu package Python. |
| `app/__main__.py` | Điểm chạy module Python. |
| `app/config.py` | Đọc và kiểm tra cấu hình Vision. |
| `app/models.py` | Nạp model YOLO, kiểm tra taxonomy sáu lớp và quản lý inference. |
| `app/schemas.py` | Pydantic schema cho request/response API. |
| `app/security.py` | Xác thực token nội bộ, bảo vệ URL tải ảnh và giới hạn request. |
| `app/analysis.py` | Tiền xử lý ảnh, chạy detection, đếm object và tạo ảnh đã đánh dấu. |
| `app/main.py` | Khai báo FastAPI endpoint, health check và điều phối request. |
| `scripts/download_models.py` | Tiện ích tải model phụ trợ khi được cho phép. |
| `training/data.yaml` | Khai báo đường dẫn dataset và mapping class YOLO. |
| `training/train.py` | Huấn luyện custom detector. |
| `training/evaluate.py` | Đánh giá model sau huấn luyện. |
| `training/export.py` | Xuất model sang định dạng triển khai khác. |
| `training/README.md` | Contract cho huấn luyện và kiểm soát artifact. |
| `tests/__init__.py` | Đánh dấu package test. |
| `tests/test_analysis.py` | Test detection/counting và xử lý ảnh. |
| `tests/test_api.py` | Test API/health endpoint. |
| `tests/test_security.py` | Test xác thực và bảo vệ URL/ảnh. |
| `tests/fixtures/images/README.md` | Quy ước dữ liệu ảnh fixture cho test. |

## 3. `frontend/` — ứng dụng web

### 3.1. Bootstrap, cấu hình và tài nguyên

| Tệp | Vai trò |
|---|---|
| `package.json` | Scripts `dev`, `build`, `test`, `lint`; dependency React, Leaflet, React Query, Socket.IO. |
| `vite.config.ts` | Cấu hình Vite và React plugin. |
| `tsconfig.json`, `tsconfig.node.json` | Cấu hình TypeScript cho mã ứng dụng và tool Node/Vite. |
| `index.html` | HTML shell mà Vite gắn React vào. |
| `README.md` | Hướng dẫn cơ bản frontend. |
| `src/main.tsx` | Mount React, Router và các provider toàn cục. |
| `src/App.tsx` | Toàn bộ route và giới hạn route theo role. |
| `src/App.css`, `src/index.css` | CSS phạm vi App và stylesheet/toàn cục. |
| `src/vite-env.d.ts` | Khai báo type đặc thù môi trường Vite. |
| `src/assets/hero.png` | Ảnh minh họa trang chủ. |
| `src/assets/react.svg`, `src/assets/vite.svg` | Asset template React/Vite. |
| `public/favicon.svg`, `public/icons.svg` | Icon tĩnh của website. |

### 3.2. Context, services, hooks, types và lib

| Tệp | Vai trò |
|---|---|
| `src/contexts/AuthContext.tsx` | Giữ phiên đăng nhập, user và role trên toàn web. |
| `src/contexts/LanguageContext.tsx` | Quản lý ngôn ngữ giao diện. |
| `src/contexts/SocketContext.tsx` | Quản lý kết nối Socket.IO dùng chung. |
| `src/contexts/ThemeContext.tsx` | Quản lý sáng/tối. |
| `src/services/api.ts` | Axios client, base URL, interceptor token/lỗi. |
| `src/services/services.ts` | Hàm gọi API nghiệp vụ tổng hợp. |
| `src/services/reverseGeocoder.ts` | Chuyển tọa độ sang địa chỉ. |
| `src/hooks/useSocket.ts` | Hook dùng Socket context/event realtime. |
| `src/hooks/hooks.ts` | Export/tập hợp hook dùng chung. |
| `src/types/index.ts` | Các type TypeScript phía web. |
| `src/lib/routes.ts` | Map role sang route trang chủ và helper route. |
| `src/lib/utils.ts` | Hàm tiện ích giao diện/classname. |
| `src/lib/api-error.ts` | Chuẩn hóa lỗi HTTP thành message hiển thị được. |
| `src/lib/ai-confidence.ts` | Chuyển confidence AI thành nhãn/màu/phần trăm an toàn. |
| `src/lib/audio-alert.ts` | Phát âm thanh cảnh báo/thông báo. |
| `src/lib/maps.ts` | Tiện ích tọa độ và thao tác bản đồ. |
| `src/lib/incident-map-marker.ts` | Tạo marker theo loại/trạng thái/mức độ sự cố. |
| `src/lib/gis-heatmap.ts` | Chuyển dữ liệu GIS thành input cho heatmap. |
| `src/lib/gis-heatmap.test.ts` | Test logic heatmap. |
| `src/lib/admin-incident-density.ts` | Tính/biến đổi số liệu mật độ sự cố cho Admin. |
| `src/lib/admin-incident-density.test.ts` | Test số liệu mật độ. |
| `src/lib/weather-details.ts` | Format/diễn giải dữ liệu thời tiết. |
| `src/lib/weather-details.test.ts` | Test trình bày dữ liệu thời tiết. |

### 3.3. Component dùng chung

| Nhóm | Tệp và vai trò |
|---|---|
| Auth | `components/auth/ProtectedRoute.tsx`: chặn route chưa đăng nhập hoặc sai role. |
| Layout | `layout/DashboardLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx`: khung dashboard dùng chung. |
| Sự cố | `incidents/ConfirmActionDialog.tsx`: xác nhận thao tác; `EvidenceGallery.tsx`: album evidence; `incident-status.tsx`: nhãn trạng thái; `IncidentTimeline.tsx`: lịch sử xử lý; `OverallAiAnalysisCard.tsx`: kết quả AI tổng quan; `VisionAnalysisCard.tsx`: kết quả YOLO. |
| Vị trí | `location/CoordinateDisplay.tsx`: tọa độ; `IncidentLocationDetails.tsx`: chi tiết nơi xảy ra; `LocationActions.tsx`: thao tác bản đồ; `LocationPickerModal.tsx`: chọn vị trí. |
| Bản đồ | `map/HeatmapLayer.tsx`: lớp heatmap Leaflet. |
| Báo cáo | `reports/EvidenceUploader.tsx`: upload ảnh; `ReportFormStepper.tsx`: form nhiều bước; `ReportPageHeader.tsx`: header; `SelectedLocationCard.tsx`: vị trí đã chọn. |
| UI cơ bản | `ui/button.tsx`, `card.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `badge.tsx`, `avatar.tsx`, `select.tsx`, `tabs.tsx`, `tooltip.tsx`: primitive giao diện. |
| UI overlay/trạng thái | `ui/dialog.tsx`, `dropdown-menu.tsx`, `app-toaster.tsx`, `loading-spinner.tsx`, `skeleton.tsx`, `empty-state.tsx`: modal/menu/thông báo/trạng thái tải-rỗng. |
| UI nâng cao | `ui/animated-counter.tsx`, `stat-card.tsx`, `language-toggle.tsx`, `sound-toggle.tsx`, `theme-toggle.tsx`: thống kê và các nút thay đổi thiết lập giao diện. |

### 3.4. Feature theo vai trò

| Nhóm | Tệp và vai trò |
|---|---|
| Citizen layout | `features/citizen/components/CitizenLayout.tsx`, `CitizenNavbar.tsx`, `CitizenFooter.tsx`: khung điều hướng người dân. |
| Citizen home | `HeroSection.tsx`, `StatsSection.tsx`, `NewsSection.tsx`, `NearbyIncidents.tsx`, `IncidentMap.tsx`: từng khối trên trang chủ. |
| Citizen reports | `CategoryFilter.tsx`: lọc category; `EditReportModal.tsx`: sửa báo cáo. |
| Citizen weather | `WeatherWidget.tsx`, `WeatherConditionIcon.tsx`: hiển thị tóm tắt/icon; `hooks/useWeather.ts`, `services/weatherService.ts`, `pages/WeatherDetails.tsx`: lấy và trình bày thời tiết chi tiết. |
| Citizen location | `hooks/useGeolocation.ts`: lấy vị trí trình duyệt. |
| Citizen pages | `pages/CitizenHome.tsx`, `MyReports.tsx`: trang chủ và danh sách báo cáo cá nhân. |
| Officer layout | `features/officer/components/OfficerLayout.tsx`, `OfficerSidebar.tsx`, `OfficerTopbar.tsx`: khung nghiệp vụ cán bộ. |
| Officer pages | `pages/OfficerDashboard.tsx`, `AssignedReports.tsx`, `PendingVerification.tsx`, `OfficerMap.tsx`, `OfficerReportDetail.tsx`, `OfficerNotifications.tsx`, `OfficerStats.tsx`: dashboard, danh sách/tác vụ, bản đồ, chi tiết, thông báo và thống kê. |
| Admin layout | `features/admin/components/AdminLayout.tsx`, `AdminSidebar.tsx`, `AdminTopbar.tsx`: khung quản trị; `CreateUserModal.tsx`: tạo user. |
| Admin pages | `AdminDashboard.tsx`, `UserManagement.tsx`, `OfficerManagement.tsx`, `ReportManagement.tsx`, `CategoryManagement.tsx`, `AdminIncidentHeatmap.tsx`, `Analytics.tsx`, `AuditLogs.tsx`, `SystemMonitoring.tsx`, `AdminSettings.tsx`: các trang điều hành/quản trị tương ứng tên gọi. |
| Assistant | `components/AssistantChat.tsx`, `AssistantLauncher.tsx`, `AssistantMessageBubble.tsx`, `RoleAwareAssistantLayout.tsx`: UI chat và hiển thị theo role; `hooks/useAssistantChat.ts`: state/gọi API; `pages/AssistantPage.tsx`: trang assistant. |

### 3.5. Các trang chung

| Tệp | Vai trò |
|---|---|
| `src/pages/Login.tsx`, `Register.tsx` | Đăng nhập và đăng ký. |
| `src/pages/CreateAlert.tsx` | Màn hình tạo báo cáo/sự cố. |
| `src/pages/AlertDetail.tsx` | Chi tiết sự cố cho Citizen. |
| `src/pages/Notifications.tsx` | Danh sách thông báo. |
| `src/pages/Profile.tsx` | Hồ sơ và thiết lập tài khoản. |

## 4. `mobile/` — Expo/React Native

### 4.1. Bootstrap, cấu hình và assets

| Tệp | Vai trò |
|---|---|
| `App.tsx` | Gắn provider, navigation và lifecycle cấp ứng dụng. |
| `index.ts` | Điểm entry của Expo. |
| `app.json` | Cấu hình Expo, tên app, icon, splash và platform. |
| `package.json`, `tsconfig.json` | Dependency Expo/React Native và TypeScript. |
| `.env.example` | Mẫu base URL và biến môi trường mobile. |
| `AGENTS.md`, `CLAUDE.md` | Hướng dẫn dành cho coding agent làm việc trong thư mục mobile. |
| `LICENSE` | Giấy phép mã nguồn. |
| `assets/icon.png`, `splash-icon.png`, `favicon.png` | Icon ứng dụng, splash và favicon web. |
| `assets/android-icon-background.png`, `android-icon-foreground.png`, `android-icon-monochrome.png` | Các lớp icon Android adaptive/monochrome. |

### 4.2. API, context, hooks, utility

| Nhóm | Tệp và vai trò |
|---|---|
| HTTP client | `api/client.ts`: Axios/token/base URL. |
| API nghiệp vụ | `api/authService.ts`, `userService.ts`, `alertService.ts`, `categoryService.ts`, `gisService.ts`, `weatherService.ts`, `notificationService.ts`, `assistantService.ts`: hàm gọi backend tương ứng tên service. |
| Context | `context/ThemeContext.tsx`, `LanguageContext.tsx`, `SocketContext.tsx`: theme, i18n và realtime socket. |
| Hooks nghiệp vụ | `hooks/useAuth.ts`, `useUsers.ts`, `useAlerts.ts`, `useCategories.ts`, `useGis.ts`, `useWeather.ts`, `useNotifications.ts`, `useAssistant.ts`: state/cache và gọi API tương ứng. |
| Hooks thiết bị/form | `hooks/useLocation.ts`, `useDashboardLocation.ts`: vị trí; `useOfflineSync.ts`: đồng bộ hàng đợi offline; `useFormValidation.ts`: validate form. |
| Utility | `utils/constants.ts`: hằng số; `storage.ts`: lưu local/secure store; `offlineQueue.ts`: queue request offline; `maps.ts`: map/tọa độ; `weather.ts`: format weather; `watermark.ts`: watermark ảnh; `aiAnalysis.ts`: format kết quả AI. |
| Dịch vụ thiết bị | `services/pushNotificationService.ts`: đăng ký/xử lý push notification; `reverseGeocoder.ts`: đổi tọa độ ra địa chỉ. |
| Type/i18n | `types/index.ts`: type mobile; `i18n/vi.ts`, `i18n/en.ts`: chuỗi tiếng Việt/Anh. |

### 4.3. Navigation, component và screen

| Nhóm | Tệp và vai trò |
|---|---|
| Navigation | `navigation/RootNavigator.tsx`: điều hướng cấp gốc; `TabNavigator.tsx`: tab mặc định; `CitizenTabNavigator.tsx`, `OfficerTabNavigator.tsx`, `AdminTabNavigator.tsx`: tab từng role; `types.ts`: type navigation. |
| UI | `components/ui/Button.tsx`, `Card.tsx`, `GlassCard.tsx`, `Badge.tsx`, `Input.tsx`, `InlineBanner.tsx`, `SettingsSection.tsx`, `Skeleton.tsx`, `StatCard.tsx`: các primitive giao diện tái sử dụng. |
| AI/Weather | `components/ai/OverallAiAnalysisCard.tsx`, `VisionAnalysisCard.tsx`: hiển thị AI/YOLO; `components/weather/WeatherCard.tsx`: thẻ thời tiết. |
| Modal | `components/modals/CategoryFormModal.tsx`, `UserFormModal.tsx`, `RolePickerModal.tsx`: quản trị danh mục/user/role; `EditProfileModal.tsx`, `ChangePasswordModal.tsx`: hồ sơ; `EditAlertModal.tsx`, `ResolutionModal.tsx`, `CloseIncidentModal.tsx`: cập nhật/kết thúc sự cố. |
| Admin component | `components/admin/OfficerPickerModal.tsx`: chọn cán bộ để phân công. |
| Auth screen | `screens/auth/LoginScreen.tsx`, `RegisterScreen.tsx`: đăng nhập và đăng ký. |
| Citizen screen | `screens/citizen/CitizenDashboardScreen.tsx`, `ReportIncidentScreen.tsx`, `MyReportsScreen.tsx`, `AlertDetailScreen.tsx`, `NotificationsScreen.tsx`, `AssistantScreen.tsx`, `WeatherDetailsScreen.tsx`: trang người dân tương ứng tên gọi. |
| Officer screen | `screens/officer/OfficerDashboardScreen.tsx`, `OfficerTasksScreen.tsx`, `OfficerMapScreen.tsx`, `OfficerAlertDetailScreen.tsx`: dashboard, nhiệm vụ, bản đồ và chi tiết. |
| Admin screen | `screens/admin/AdminDashboardScreen.tsx`, `AdminGisScreen.tsx`, `AdminIncidentsScreen.tsx`, `AdminMoreScreen.tsx`, `AdminOfficerAvailabilityScreen.tsx`, `AuditLogsScreen.tsx`, `CategoryManagementScreen.tsx`, `UserManagementScreen.tsx`: các màn hình điều hành. |
| Screen dùng chung/legacy | `screens/LocationPickerScreen.tsx`: chọn vị trí toàn màn hình; `screens/AlertDetailScreen.tsx`, `ReportIncidentScreen.tsx`, `screens/index.ts`: export hoặc phiên bản dùng chung/legacy của screen. |

## 5. Dataset, model và file sinh tự động

| Vị trí | Nội dung và cách xử lý |
|---|---|
| `datasets/incoming/EcoAlert_YOLO26_V1.zip` | Gói dataset đầu vào. |
| `datasets/ecoalert-waste-v1/images/train` | 3.391 ảnh dùng huấn luyện. |
| `datasets/ecoalert-waste-v1/images/val` | 412 ảnh dùng validation. |
| `datasets/ecoalert-waste-v1/images/test` | 437 ảnh dùng đánh giá cuối. |
| `datasets/ecoalert-waste-v1/labels/*` | Mỗi file `.txt` ghép với một ảnh cùng tên, chứa class ID và bounding box theo chuẩn YOLO. |
| `models/ecoalert-waste-yolo26n-v1.pt` | Trọng số YOLO triển khai; Vision service kiểm tra model có đúng taxonomy sáu class. |
| `**/node_modules/` | Dependency cài bởi npm; luôn tái tạo bằng `npm install`. |
| `**/package-lock.json` | Lockfile npm, ghi chính xác phiên bản dependency đã cài; không chứa logic ứng dụng nên không diễn giải từng file. |
| `backend/**/dist/`, `frontend/dist/` | Kết quả build. Sửa TypeScript/Python nguồn rồi build lại, không sửa artifact. |
| `frontend/dist-prebuild-backup/` | Bản backup bundle frontend trước build; có thể xóa khi đã xác nhận không cần khôi phục. |
| `mobile/.expo/` | Metadata/cache của Expo theo máy. |

## 6. Điểm bắt đầu khi đọc mã

1. Web: `frontend/src/main.tsx` → `App.tsx` → context → feature/page.
2. Mobile: `mobile/index.ts` → `App.tsx` → `RootNavigator.tsx` → screen.
3. Backend HTTP: `api-gateway/src/server.ts` → `<service>/src/server.ts` → `app.ts` → route → controller → service → repository/model.
4. AI: `ai-service/src/services/multimodal-analysis.service.ts` → `vision-client.service.ts` → `vision-service/app/main.py` và `analysis.py`.
5. Workflow sự cố: `alert-service/src/services/alert.service.ts` là vị trí quan trọng nhất.
