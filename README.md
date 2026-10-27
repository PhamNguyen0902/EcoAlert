# EcoAlert — Hệ thống Báo cáo, Thẩm định Thị giác Máy tính (AI Vision) và Điều phối Xử lý Sự cố Rác thải Đô thị theo Thời gian thực

**EcoAlert** là nền tảng thông minh hỗ trợ quản lý và điều phối xử lý sự cố rác thải đô thị tại TP.HCM theo thời gian thực. Trọng tâm cốt lõi của hệ thống là **Pipeline Thị giác Máy tính Đa mô hình (Multi-Model YOLO)** kết hợp **Phân tích Ngữ nghĩa Đa phương thức (Multimodal LLM)** để tự động nhận diện vật thể rác thải, ước tính khối lượng, chống báo cáo giả và tự động kiểm định kết quả dọn dẹp tại hiện trường.

---

## 1. Trọng tâm Công nghệ: AI Vision & Thẩm định Rác thải Tự động

Hệ thống giải quyết bài toán kiểm duyệt bằng chứng hình ảnh thực địa thông qua kiến trúc AI 3 tầng hoạt động chặt chẽ giữa Mobile, `media-service`, `vision-service` và `ai-service`:

### 1.1. Kiến trúc Đa mô hình YOLO (Multi-Model Vision Service)
Thay vì phụ thuộc vào một tệp trọng số đơn lẻ, `backend/vision-service` (Python / FastAPI / Ultralytics YOLO) vận hành kiến trúc **Multi-Model Detector** quản lý qua `config/models.json`:
- **Chạy song song đa mô hình chuyên biệt**:
  - `ecoalert_general` (`BEST_ECOALERT_YOLO11N.pt`): Nhận diện chi tiết các vật thể rác phổ biến (`plastic_bottle`, `plastic_bag`, `plastic_cup`, `metal_can`, `cardboard`, `glass_bottle`).
  - `asian_waste` (`BEST_ASIAN_WASTE_YOLO11S.pt`): Nhận diện các nhóm chất thải đặc thù đô thị (`garbage_bag`, `construction_waste`, `organic_waste`, `animal_waste`, `plastic`, `metal`, `paper`, `glass`, `waste`).
- **Thuật toán Hợp nhất Khung bao Liên mô hình (`merge_detections` & IoU)**: Tự động đối chiếu độ giao thoa (IoU) giữa các mô hình để loại bỏ khung trùng lặp cùng nhãn nhưng vẫn giữ lại đầy đủ dấu vết nguồn gốc nhận diện (**Vision Provenance** — ghi rõ từng bounding box `[x1, y1, x2, y2]` do mô hình nào phát hiện với độ tin cậy bao nhiêu).
- **Cơ chế Cờ Kiểm duyệt (`review_classes` & `requiresManualReview`)**: Tự động gắn cờ yêu cầu rà soát đối với các nhãn tổng quát hoặc khi mô hình có độ tin cậy ở ngưỡng biên.

### 1.2. Phân tích Đa phương thức & Ước lượng Khối lượng (`ai-service`)
- **Tổng hợp Đặc trưng Thị giác (`buildVisionDetectionSummary`)**: Gom nhóm số lượng vùng vật thể phát hiện được, lớp vật liệu chiếm ưu thế (`dominantClass`) và độ tin cậy trung bình.
- **Đánh giá Ngữ nghĩa & Khối lượng (`Multimodal Analysis`)**: Kết hợp kết quả từ YOLO với mô hình ngôn ngữ thị giác (qua OpenRouter) để:
  - Đánh giá mức độ nghiêm trọng (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  - Ước tính khối lượng rác thực tế tại hiện trường (`VisualMassEstimate`: khoảng cân nặng `minKg` – `maxKg`, quy mô `VERY_SMALL` đến `VERY_LARGE`).
  - Sinh bản tóm tắt hiện trường (`overallSummary`) và căn cứ nhận định (`shortReason`) bằng tiếng Việt hỗ trợ Admin điều phối phương tiện thu gom phù hợp (nhân sự thường hoặc xe tải/xe ép rác chuyên dụng cho xà bần, rác cồng kềnh).

### 1.3. Chống Gian lận Báo cáo & Tự động Nghiệm thu Hiện trường
- **Xác thực Ảnh chụp Thực địa (Citizen App)**:
  - Khóa hoàn toàn tính năng chọn ảnh có sẵn từ thư viện; bắt buộc chụp trực tiếp qua **Live Camera** kèm tọa độ GPS phần cứng và dấu thời gian thực (`captureMetadata`).
  - Tự động đóng dấu **Watermark** (Tọa độ GPS, Địa chỉ Reverse Geocoding, Thời gian chụp) và **giữ nguyên kết quả khung nhận diện YOLO** từ lúc người dân chụp cho đến trang chi tiết của Cán bộ và Admin mà không phải chạy nhận diện lại.
- **Tự động Kiểm định Nghiệm thu Sau Xử lý (`is_clean_scene` / Officer Resolution)**:
  - Khi Cán bộ hiện trường hoàn tất dọn dẹp và chụp ảnh nghiệm thu (After), hệ thống kiểm tra chéo khoảng cách GPS Haversine tại điểm rác và đẩy ảnh qua `vision-service` để kiểm tra trạng thái sạch rác (`is_clean_scene`), kết hợp giao diện đối chiếu **Trước & Sau (Before / After)** phục vụ Admin đóng hồ sơ.

---

## 2. Kiến trúc Hệ thống & Các Phân hệ (Microservices)

Hệ thống được thiết kế theo kiến trúc **Microservices kết hợp Event-Driven (RabbitMQ)** và giao tiếp thời gian thực qua **Socket.IO**:

| Dịch vụ / Phân hệ | Công nghệ chính | Vai trò cốt lõi |
| :--- | :--- | :--- |
| **`vision-service`** | Python, FastAPI, PyTorch, Ultralytics YOLO11, OpenCV | Suy luận thị giác máy tính đa mô hình, trả về tọa độ Bounding Box, nhãn vật liệu rác, Vision Provenance và kiểm định ảnh sạch rác sau xử lý. |
| **`ai-service`** | Node.js, TypeScript, RabbitMQ, OpenRouter LLM | Xử lý bất đồng bộ sự kiện `alert.created`, kết hợp kết quả YOLO Vision với LLM đa phương thức để ước tính khối lượng rác, đánh giá mức độ nghiêm trọng và tóm tắt hiện trường. |
| **`media-service`** | Node.js, Express, AWS S3, HMAC Ownership | Lưu trữ hình ảnh minh chứng có chữ ký xác thực quyền sở hữu (`ownershipProof`), chống trùng lặp (`idempotencyKey`) và cầu nối phân tích ảnh từ xa với `vision-service`. |
| **`alert-service`** | Node.js, Express, MongoDB, RabbitMQ | Trái tim nghiệp vụ quản lý vòng đời sự cố (`pending` → `verified` → `assigned` → `in_progress` → `resolved` → `closed`), kiểm chứng GPS hiện trường, quản lý ca trực và khóa phân công (`AssignmentLock`). |
| **`gis-service`** | Node.js, Express, MongoDB 2dsphere, OSRM | Quản lý ranh giới vùng phục vụ (`ServiceArea` GeoJSON Polygon), bản đồ nhiệt mật độ sự cố (Heatmap) và tính toán lộ trình di chuyển thực tế qua OSRM TP.HCM. |
| **`user-service`** | Node.js, Express, MongoDB, Redis, JWT | Quản lý định danh, xác thực JWT/Refresh Token, phân quyền 3 vai trò (`CITIZEN`, `OFFICER`, `ADMIN`), danh bạ cán bộ và nhật ký kiểm toán (`AuditLog`). |
| **`notification-service`** | Node.js, Socket.IO, RabbitMQ, Expo Push | Đồng bộ trạng thái sự cố thời gian thực trên Web/Mobile và gửi thông báo đẩy tiếng Việt theo ngữ cảnh từng vai trò. |
| **`api-gateway`** | Node.js, Express Proxy, JWT Auth | Cổng giao tiếp tập trung, điều hướng request, kiểm soát truy cập và rate-limiting. |
| **`frontend` (Web Portal)** | React, TypeScript, Vite, TailwindCSS, Framer Motion, Leaflet | Cổng điều hành dành cho Admin (Dashboard KPI, Điều phối 4 bước với ảnh YOLO Bounding Box, Quản lý Vùng phục vụ, Kiểm định AI Vision) và giao diện Web cho Officer/Citizen. |
| **`mobile` (Mobile App)** | React Native, Expo, TypeScript, ViewShot, React Native Maps | Ứng dụng thực địa cho **Người dân** (Chụp ảnh Live Camera, nhận diện YOLO tức thì, lưu nháp & đồng bộ Offline) và **Cán bộ** (Quản lý ca trực, Bản đồ tác chiến, Quy trình 3 bước Check-in GPS → Xử lý → Chụp nghiệm thu). |

---

## 3. Luồng Nghiệp vụ 3 Vai trò (End-to-End Workflow)

1. **Người dân (Citizen Mobile App)**:
   - Mở Camera trực tiếp tại điểm phát sinh rác $\rightarrow$ Hệ thống tự động khóa tọa độ GPS nền, dịch ngược địa chỉ và đóng dấu Watermark.
   - Hình ảnh được gửi lên `media-service` & `vision-service` để **YOLO khoanh vùng các vật thể rác** ngay trên màn hình kèm đánh giá tự động.
   - Hỗ trợ chụp nhiều góc độ, tự động lưu bản nháp (`draftStorage`) và đẩy vào hàng đợi ngoại tuyến (`offlineQueue`) nếu mất kết nối mạng.
2. **Hệ thống AI & Điều phối Tự động (`alert-service` + `ai-service` + `gis-service`)**:
   - Giữ nguyên kết quả `visionEvidence` đã nhận diện từ bước chụp và phân tích sâu ngữ nghĩa đa phương thức qua RabbitMQ.
   - Xác định báo cáo nằm trong đa giác `ServiceArea` nào, tìm danh sách cán bộ đang trong ca trực (`ON_SHIFT`), tính khoảng cách di chuyển thực tế qua OSRM và cân bằng tải công việc để gợi ý/giao việc tự động.
3. **Cán bộ Hiện trường (Officer Mobile App)**:
   - Nhận nhiệm vụ trong ca trực, xem ảnh hiện trường đã khoanh vùng YOLO và lộ trình di chuyển trên bản đồ tác chiến (`OfficerOperationalMap`).
   - Thực hiện quy trình 3 bước: **Bước 1: Check-in GPS** tại hiện trường (bán kính $\le 100\text{m}$, sai số $\le 50\text{m}$) $\rightarrow$ **Bước 2: Thu gom, xử lý rác** $\rightarrow$ **Bước 3: Chụp ảnh sau xử lý (After)** kèm ghi nhận phương pháp và vật tư sử dụng.
4. **Quản trị viên (Admin Web Portal)**:
   - Thẩm định hồ sơ trên giao diện Bento Grid trực quan: đối chiếu vị trí GPS, kiểm tra ảnh hiện trường có khung Bounding Box YOLO, theo dõi tiến độ ca trực, so sánh ảnh Trước/Sau và phê duyệt nghiệm thu đóng hồ sơ.

---

## 4. Khởi chạy Hệ thống & Kiểm thử Tự động (Automated Testing)

### 4.1. Khởi chạy Hạ tầng & Dịch vụ bằng Docker Compose
```powershell
# 1. Khởi chạy các dịch vụ cơ sở dữ liệu & message broker (MongoDB, Redis, RabbitMQ)
docker compose -f docker-compose.infrastructure.yml up -d

# 2. Khởi chạy toàn bộ cụm Microservices (bao gồm vision-service, ai-service, alert-service...)
docker compose up -d --build
```

### 4.2. Chạy Bộ Kiểm thử Tự động (Unit & Integration Tests)
Dự án được trang bị bộ kiểm thử tự động bao phủ cả 4 tầng:
- **Vision Service (Python Multi-Model & Smoke Test)**:
  ```powershell
  cd backend/vision-service
  pytest tests/test_multimodel.py
  python scripts/smoke_api.py
  python scripts/benchmark.py
  ```
- **Backend Microservices (`alert-service`, `ai-service`, `gis-service`, `media-service`)**:
  ```powershell
  cd backend/alert-service && npm test
  cd ../ai-service && npm test
  cd ../gis-service && npm test
  cd ../media-service && npm test
  ```
- **Mobile App (72+ kịch bản Camera, GPS, AI Pipeline, Offline Queue, 3-Step Workflow)**:
  ```powershell
  cd mobile
  npx tsc --noEmit
  node --test tests/*.test.cjs
  ```
- **Web Frontend**:
  ```powershell
  cd frontend
  npx tsc --noEmit
  npm run build
  npm run test:routing
  ```

---

## 5. Phân hệ Phụ trợ: Hạ tầng Định tuyến OSRM Riêng cho TP.HCM

Để đảm bảo tính năng dẫn đường và tính khoảng cách điều phối cán bộ trong `gis-service` hoạt động ổn định, không bị phụ thuộc hay lỗi `ETIMEDOUT` từ máy chủ OSRM công cộng, hệ thống sử dụng container OSRM nội bộ được cắt và dựng đồ thị MLD riêng cho khu vực TP.HCM.

### 5.1. Luồng Định tuyến Nội bộ
`Officer Mobile MapView (hoặc Web Leaflet)` $\rightarrow$ `API Gateway (/api/v1/gis/route)` $\rightarrow$ `gis-service (/route)` $\rightarrow$ `http://osrm:5000` $\rightarrow$ `GeoJSON LineString`.

- **Contract dữ liệu**: Trả về `distanceMeters`, `durationSeconds`, `geometry.type = "LineString"`, `geometry.coordinates = [[longitude, latitude], ...]`.
- **An toàn & Chính xác**: Không vẽ đường thẳng giả lập khi lỗi, không tự động fallback sang OSRM công cộng. Cổng `5000` của OSRM chỉ mở trong mạng nội bộ Docker.

### 5.2. Nguồn Dữ liệu Bản đồ & Phạm vi Phục vụ
- **Nguồn PBF**: Sử dụng `data/osrm/vietnam-latest.osm.pbf` từ Geofabrik Vietnam (`SHA256: d954e09b891079520bf13799377a9cf783cb1d9fe2745ef11864cb8d2a5b2048`).
- **Đa giác cắt vùng (`scripts/osrm/hcm-region.json`)**: Từ `geoBoundaries gbOpen VNM ADM1` (`shapeISO=VN-SG`) kèm vùng đệm (buffer) **10 km** tính trong hệ tọa độ mét UTM 48N (`EPSG:32648`), tổng diện tích bao phủ khoảng **5.357,46 km²** (`lng: 106.317776–107.122280`, `lat: 10.240454–11.224564`).
- **Kiểm tra biên**: Endpoint nằm ngoài vùng phục vụ trả mã lỗi **422**; bán kính snap tối đa `1.000m`.
- **Image & Profile**: Sử dụng `ghcr.io/project-osrm/osrm-backend:v5.27.1` với pipeline MLD (`osrm-extract -p /opt/car.lua` $\rightarrow$ `osrm-partition` $\rightarrow$ `osrm-customize` $\rightarrow$ `osrm-routed --algorithm mld --mmap`).

### 5.3. Chuẩn bị Đồ thị OSRM TP.HCM (Windows PowerShell)
Từ thư mục gốc của repository:
```powershell
.\scripts\osrm\prepare-hcm.ps1
if ($LASTEXITCODE -ne 0) { throw 'HCMC preparation failed' }
```
- Nếu cần tải mới file PBF Việt Nam: `.\scripts\osrm\prepare-hcm.ps1 -DownloadVietnam`
- Nếu cần ép dựng lại đồ thị mới: `.\scripts\osrm\prepare-hcm.ps1 -Force`
- Mỗi lần chạy thành công sẽ tạo thư mục graph bất biến trong `data/osrm/hcm/graphs/<id>/` và chỉ cập nhật con trỏ `active.txt` sau khi kiểm tra đủ tệp sidecar và mở thử `osrm-routed --trial=on` thành công.

### 5.4. Khởi động và Kiểm thử OSRM / GIS
```powershell
Push-Location backend/gis-service
npm run build
if ($LASTEXITCODE -ne 0) { throw 'GIS build failed' }
Pop-Location

docker compose up -d --no-deps --wait --wait-timeout 90 osrm
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 90 gis-service
docker compose ps osrm gis-service
```

Kiểm thử tích hợp định tuyến hai chiều:
```powershell
Get-Content -Raw scripts/osrm/integration.mjs | docker compose exec -T gis-service node --input-type=module
node scripts/osrm/mobile-integration.cjs
```

### 5.5. Bảng Biến Môi trường OSRM / GIS

| Biến | Mặc định | Ý nghĩa |
| :--- | :--- | :--- |
| `OSRM_IMAGE` | `ghcr.io/project-osrm/osrm-backend:v5.27.1` | Image đồng nhất khi prepare và runtime |
| `OSRM_SOURCE_DIR` | `./data/osrm` | Thư mục chứa file Vietnam PBF gốc |
| `OSRM_DATA_DIR` | `./data/osrm/hcm` | Thư mục lưu PBF TP.HCM và đồ thị persistent |
| `OSRM_THREADS` | `2` | Số luồng CPU khi prepare/runtime |
| `OSMIUM_MEMORY` | `4g` | Giới hạn RAM bước cắt PBF bằng Osmium |
| `OSRM_PREPARE_MEMORY` | `3g` | Giới hạn RAM bước dựng đồ thị TP.HCM |
| `OSRM_BASE_URL` | `http://osrm:5000` | Địa chỉ OSRM nội bộ trong Docker network |
| `OSRM_TIMEOUT_MS` | `10000` | Thời gian chờ tối đa mỗi truy vấn (100–30000ms) |
| `OSRM_ROUTING_PROFILE` | `driving` | Cấu hình định tuyến đường bộ |
| `OSRM_DATA_ROOT` | `/osrm-data` | Đường dẫn mount trong container để GIS đọc `coverage.geojson` |

### 5.6. Lưu ý Kết nối Mobile (Expo Go) trên Thiết bị Thật
1. Trong `mobile/.env`, đặt `EXPO_PUBLIC_API_URL=http://<IP_LAN_MAY_TINH>:3000/api` (không dùng `localhost` khi chạy trên điện thoại thật).
2. Điện thoại và máy tính kết nối cùng mạng Wi-Fi, cấp quyền Location cho ứng dụng.
3. Khởi chạy lại Metro bundler xóa cache:
   ```powershell
   cd mobile
   npx expo start -c
   ```
