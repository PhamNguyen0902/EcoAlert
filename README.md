# EcoAlert — OSRM riêng cho TP.HCM, chỉ đường trong app

## Luồng định tuyến

Officer mobile MapView (hoặc web Leaflet) → API Gateway `/api/v1/gis/route` → GIS `/route` → `http://osrm:5000` → GeoJSON LineString.

Contract không đổi: `success/data`, `distanceMeters`, `durationSeconds`, `geometry.type = "LineString"`, `geometry.coordinates = [[longitude, latitude], ...]`. Mobile đổi từng điểm thành object `latitude/longitude`; web đổi thành `[latitude, longitude]`. Không vẽ đường thẳng thay tuyến thật, không fallback OSRM công cộng và không tự chuyển sang Google Maps khi lỗi.

OSRM chỉ mở 5000 trong Docker network; không publish ra LAN. GIS internal route được gateway bảo vệ bằng cơ chế xác thực hiện có. Nút Google Maps riêng chỉ chạy khi người dùng chủ động chọn.

## Nguyên nhân và phạm vi sửa

- Provider công cộng từng timeout `ETIMEDOUT`, làm GIS trả 502.
- Extract toàn Việt Nam đã OOM tại 4/5/6 GiB; chỉ có sidecar dở dang, chưa có graph MLD ready. Runtime cũ tìm graph chưa hoàn chỉnh nên unhealthy/restart loop.
- Bây giờ cắt polygon TP.HCM, chuẩn bị graph riêng và kiểm tra đủ sidecar + thử mở graph trước khi publish pointer.
- Mobile chờ MapView ready và có kích thước trước khi fit tuyến; giữ loading, hiển thị lỗi GIS cụ thể và không tự mở Google.
- API URL local mobile đã được đổi từ IP LAN cũ không kết nối được sang IP Wi-Fi workstation tại thời điểm kiểm thử. Địa chỉ LAN có thể thay đổi; xem phần Expo Go.

Các service user/AI/vision/media/notification và dữ liệu hiện có không bị xóa hoặc khởi động lại trong đợt triển khai này.

## Nguồn bản đồ và vùng phục vụ

Dùng lại `data/osrm/vietnam-latest.osm.pbf` đã tải từ [Geofabrik Vietnam](https://download.geofabrik.de/asia/vietnam.html), không tải lại toàn Việt Nam trong lần triển khai. OSM timestamp: `2026-10-11T20:21:06Z`; source SHA256 `d954e09b891079520bf13799377a9cf783cb1d9fe2745ef11864cb8d2a5b2048`.

Polygon gốc từ [geoBoundaries gbOpen VNM ADM1](https://www.geoboundaries.org/api/current/gbOpen/VNM/ADM1/), pin commit `9469f09` và SHA256 trong `scripts/osrm/hcm-region.json`. Chọn `shapeISO=VN-SG` (Ho Chi Minh), boundary year represented **2008**, Public Domain. Đây là phạm vi đô thị/địa giới TP.HCM lịch sử, gồm cả Củ Chi/Cần Giờ, **không phải toàn bộ TP.HCM sau sáp nhập năm 2025**; không dùng polygon này để quyết định thẩm quyền hành chính.

Buffer **10 km**, tính trong hệ mét UTM 48N (`EPSG:32648`), sau đó đổi về WGS84. Có thể cấu hình buffer 5–10 km/nguồn polygon trong `hcm-region.json`, nhưng phải pin lại checksum, ghi rõ phạm vi và chạy prepare/restart trong maintenance window.

- Coverage polygon + buffer: khoảng **5.357,46 km²**.
- Envelope dùng để mô tả, không phải bbox cắt tùy tiện: longitude 106.317776–107.122280; latitude 10.240454–11.224564.
- Osmium `smart` với `types=restriction` giữ complete ways và turn restrictions để giảm đứt đường ở biên. Vì complete ways, bounds PBF có thể rộng hơn polygon; GIS vẫn kiểm tra cả hai endpoint nằm trong polygon được hỗ trợ.
- Endpoint ngoài polygon trả **422**; không snap từ Hà Nội về TP.HCM.
- Snap endpoint tối đa 1.000m; không có đường phù hợp trả lỗi thay vì tuyến giả.

Dữ liệu © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright); giữ attribution OSM trên map.

## Image, profile và tài nguyên

Dùng image chính thức **`ghcr.io/project-osrm/osrm-backend:v5.27.1`** cho cả prepare/runtime. [Project OSRM Docker recipes](https://github.com/Project-OSRM/osrm-backend/wiki/Docker-Recipes) hướng dẫn GHCR; tag Docker Hub `osrm/osrm-backend:v5.27.1` không có manifest khi kiểm tra, nên không dùng tag đó.

Pipeline MLD: `osrm-extract -p /opt/car.lua` → `osrm-partition` → `osrm-customize` → `osrm-routed --algorithm mld --mmap`. Extract dùng `--disable-location-cache` vì không có `--location-dependent-data`; phải xem lại tùy chọn nếu bổ sung luật theo vùng.

**Chỉ profile ô tô, không cam kết định tuyến xe máy đúng mọi hạn chế** (cao tốc, làn riêng, giờ cấm...). Chỉ chấp nhận `driving`; không đổi tên profile thành motorcycle để giả hỗ trợ. ETA không có traffic live/ngập lụt/giọng nói.

Prepare chạy tuần tự, mặc định 2 CPU:
- Osmium: limit 4g, peak cgroup đo **4.021.956.608 bytes** (~3,75 GiB).
- OSRM HCM: limit 3g, peak cgroup lần Force **568.336.384 bytes** (~542 MiB).
- Runtime OSRM: limit 2g, mmap. Đây là giới hạn, không phải RAM luôn sử dụng.
- HCM PBF **23.291.814 bytes**; graph active gồm 31 file **309.512.695 bytes** (bao gồm bản copy PBF).
- Nên chừa vài GB disk để giữ graph cũ, build lỗi và candidate mới. Dữ liệu cũ/graph lỗi chưa bị xóa nên tổng thư mục thực tế lớn hơn graph active.

Không tự tăng RAM Docker Desktop hoặc dừng service khác. Peak cgroup có thể gồm page cache, không đồng nhất với RSS tiến trình.

## Chuẩn bị lần đầu — Windows PowerShell

Từ root repository, giữ nguyên các `.env` hiện có. **Không copy đè file mẫu lên credentials đang dùng**.

```powershell
.\scripts\osrm\prepare-hcm.ps1
if ($LASTEXITCODE -ne 0) { throw 'HCMC preparation failed' }
```

Script tự xác định root dù chạy từ thư mục khác, dùng file lock để tránh chạy đồng thời, kiểm tra exit code từng lệnh Docker. Docker tools được build một lần (apt cần network); boundary được tải và kiểm SHA256 nếu chưa có. Extraction/preparation chạy offline sau khi có input.

Nếu chưa có Vietnam PBF, ưu tiên đặt bản đã tải tại `OSRM_SOURCE_DIR/vietnam-latest.osm.pbf`. Chỉ tải mới khi thật sự cần:

```powershell
.\scripts\osrm\prepare-hcm.ps1 -DownloadVietnam
```

Script download vào candidate riêng, kiểm MD5 nguồn rồi mới publish; không ghi đè Vietnam PBF đang tồn tại.

Chạy lại bình thường sẽ xác minh fingerprint/input/graph và **bỏ qua extract/partition/customize** nếu hợp lệ. Để chủ động rebuild:

```powershell
.\scripts\osrm\prepare-hcm.ps1 -Force
```

Mỗi lần thành công tạo graph bất biến mới trong `graphs/`; chỉ cập nhật `active.txt` sau khi đủ sidecar và `osrm-routed --trial=on` thành công. Graph cũ và dữ liệu Vietnam giữ nguyên. Runtime đang chạy vẫn giữ graph đã mở; **prepare không phải hot reload**, cần restart/recreate OSRM và GIS sau đó.

## Dữ liệu persistent

Mặc định:

```text
data/osrm/
  vietnam-latest.osm.pbf       # nguồn cũ giữ nguyên, không dùng trực tiếp để extract OSRM
  build/                      # dữ liệu Vietnam dở dang cũ giữ nguyên nếu có
  hcm/
    hcm.osm.pbf
    coverage.geojson
    extract-manifest.json
    active.txt                # graphs/<fingerprint>-<timestamp>
    graphs/<id>/
      hcm.osm.pbf
      hcm.osrm.*              # MLD sidecars; không cần một file hcm.osrm riêng
      coverage.geojson
      extract-manifest.json
      preparation-metrics.txt
      ecoalert-ready
    sources/                  # boundary đã kiểm checksum
```

Bind mount nằm ngoài writable layer container, ngoài Git. Có thể chuyển sang ổ/thư mục đủ disk bằng `OSRM_SOURCE_DIR` và `OSRM_DATA_DIR`; không chuyển/xóa dữ liệu đang chạy nếu chưa có phương án rollback.

## Khởi động chỉ OSRM/GIS

Compose hiện mount GIS `dist` read-only, phải build local trước. Các infrastructure/service khác cần đang chạy như stack hiện tại.

```powershell
Push-Location backend/gis-service
npm run build
if ($LASTEXITCODE -ne 0) { throw 'GIS build failed' }
Pop-Location

docker compose up -d --no-deps --wait --wait-timeout 90 osrm
if ($LASTEXITCODE -ne 0) { throw 'OSRM not healthy; inspect logs' }
docker compose up -d --no-deps --force-recreate --wait --wait-timeout 90 gis-service
if ($LASTEXITCODE -ne 0) { throw 'GIS not healthy; inspect logs' }
docker compose ps osrm gis-service
```

Nếu image GIS chưa được build, dùng `docker compose build gis-service` trước. Sau prepare Force với container OSRM đang chạy, dùng `docker compose restart osrm`, đợi healthy rồi restart GIS để mở đúng graph mới. Với lần khởi động Compose thông thường, GIS có `depends_on: osrm: condition: service_healthy`; các job prepare nằm trong profile `routing-tools`, không chạy theo startup.

OSRM healthcheck dùng Bash `/dev/tcp` gửi HTTP nearest tại TP.HCM, kiểm HTTP 200 + code Ok; không cần curl/wget. Thiếu graph/sidecar: log rõ một lần, container chờ không mở HTTP và unhealthy, **không restart storm**. Sau prepare thành công phải restart OSRM.

GIS `/health` giữ liveness; `/health/ready` kiểm coverage + nearest thật tới OSRM, trả 200/503. GIS log chỉ provider host, loại lỗi, thời gian, số điểm; không log token/URL chứa tọa độ.

Runtime OSRM dùng `--verbosity WARNING` thay vì INFO mặc định, tránh access log chứa URL/tọa độ từng request; vẫn giữ cảnh báo/lỗi và log startup của wrapper. Log cũ trước thay đổi được giữ nguyên, không tự xóa.

## Cấu hình

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| OSRM_IMAGE | ghcr.io/project-osrm/osrm-backend:v5.27.1 | Cùng phiên bản khi prepare/run |
| OSRM_SOURCE_DIR | ./data/osrm | Nguồn Vietnam PBF giữ nguyên |
| OSRM_DATA_DIR | ./data/osrm/hcm | HCM input + graph persistent |
| OSRM_THREADS | 2 | Threads prepare/runtime |
| OSMIUM_MEMORY | 4g | Limit riêng bước cắt PBF |
| OSRM_PREPARE_MEMORY | 3g | Limit riêng prepare HCM |
| OSRM_BASE_URL | http://osrm:5000 | Provider duy nhất, Docker DNS |
| OSRM_TIMEOUT_MS | 10000 | Fetch timeout, giới hạn 100–30000ms |
| OSRM_ROUTING_PROFILE | driving | Car graph; không hỗ trợ profile khác |
| OSRM_DATA_ROOT | /osrm-data trong Compose | GIS đọc coverage active cùng graph |

Xem `.env.example`, `backend/gis-service/.env.example`. Host-only GIS cần mount/path phù hợp và private OSRM URL riêng; không tự đổi sang provider công cộng.

## Kiểm thử thực tế

Windows:

```powershell
Get-Content -Raw scripts/osrm/integration.mjs | docker compose exec -T gis-service node --input-type=module
if ($LASTEXITCODE -ne 0) { throw 'GIS/OSRM integration failed' }
node scripts/osrm/mobile-integration.cjs
if ($LASTEXITCODE -ne 0) { throw 'Mobile routing integration failed' }
```

GIS integration gọi readiness, hai tuyến thật hai chiều, so sánh mọi tọa độ/metrics với private OSRM trực tiếp; kiểm input lỗi 400 và Hà Nội ngoài vùng 422. Mobile integration dùng **getOfficerRoute/parseOfficerRoute thật**, transport HTTP tới GIS bên trong container, kiểm đổi trục đúng, metrics và lỗi ngoài vùng. Không mock OSRM, không gọi Google/public provider. Đây **không phải** bằng chứng đã đăng nhập/hiển thị native trên thiết bị; gateway từ bên ngoài vẫn cần Officer Bearer token thật.

Kết quả 12/10/2026, sau restart riêng OSRM và GIS (không restart toàn Docker Desktop):

| Tuyến [latitude, longitude] | HTTP | Mét | Giây | Điểm geometry |
| --- | --- | --- | --- | --- |
| [10.7769,106.7009] → [10.84498,106.708477] | 200 | 10117.6 | 690.8 | 329 |
| Chiều ngược lại | 200 | 10077.6 | 691.6 | 311 |

OSRM và GIS healthy; graph/pointer giữ nguyên sau restart, không chạy extract lại. `osmium fileinfo -e` và `osmium check-refs` pass. Các bước extract/partition/customize + thử mở MLD graph đã chạy thành công, kể cả Force; chạy lại không Force đã xác minh skip.

Kiểm tra hồi quy sau thay đổi:
- Mobile `npx tsc --noEmit`: pass; `node --test tests/*.test.cjs`: **187 pass**, không fail/skip.
- GIS `npm test` (gồm TypeScript build): **15 pass, 1 skip**; test MongoDB integration được skip theo cấu hình suite hiện có.
- Web `npm run build`: pass; `npm run test:routing`: **3 pass**. Script `npm test` cũ của web tham chiếu các file không có trong repository, nên không tuyên bố toàn bộ web suite pass.
- `git diff --check`: pass. Các lệnh test Node cần quyền tạo tiến trình; lỗi sandbox `spawn EPERM` ban đầu đã được xử lý bằng chạy lại có quyền phù hợp, không sửa tests để né lỗi.

## Officer mobile / Expo Go

1. Trong `mobile/.env`, `EXPO_PUBLIC_API_URL` phải là địa chỉ LAN máy backend, không dùng localhost trên iPhone. Workstation khi kiểm thử: `http://192.168.1.15:3000/api` (gateway health đã trả 200). Không hardcode IP này trong source dùng chung.
2. Điện thoại và máy tính cùng Wi-Fi, cấp quyền vị trí, kiểm tra gateway reachable từ điện thoại.
3. Reload Metro để nhận environment mới:

```powershell
cd mobile
npx expo start -c
```

4. Đăng nhập Officer → mở nhiệm vụ tại vùng hỗ trợ → Bản đồ → **Bắt đầu chỉ đường**.
5. App lấy GPS, gọi GIS, vẽ Polyline theo toàn bộ geometry OSRM, hiển thị km/ETA và fitToCoordinates sau map ready. Vẫn ở EcoAlert. Thử refresh tuyến, thiếu quyền GPS, lỗi kết nối và vị trí ngoài vùng.
6. Nút Google Maps riêng chỉ chạy nếu chủ động bấm.

Tests render/hook kiểm Polyline đúng điểm, chờ map ready, label khoảng cách và lỗi ngoài vùng; **chưa kiểm trực tiếp giao diện native trên iPhone/Android và chưa chạy luồng gateway có đăng nhập bằng thiết bị thật**. Cần hoàn tất bước này trong Expo Go; không coi unit test render là kiểm thử native.

## Cập nhật OSM/ranh giới và rollback

- Giữ nguồn cũ. Đặt nguồn mới vào **OSRM_SOURCE_DIR mới**, không ghi đè/xóa bản đang dùng; nếu cần boundary mới, cập nhật URL/hash/metadata rõ ràng.
- Chọn **OSRM_DATA_DIR mới** khi cần giữ cả input cũ; chạy prepare (hoặc Force trong data dir hiện tại nếu chủ động thay input, graph cũ vẫn được giữ).
- Kiểm tra manifest, checksum, trial open, rồi restart/recreate OSRM/GIS trong maintenance window; chạy cả hai integration scripts.
- Rollback an toàn bằng thư mục nguồn/data cũ đã giữ, image cùng phiên bản; recreate riêng OSRM/GIS và kiểm tra lại. Không sửa pointer thủ công tới graph chưa kiểm.
- Không dùng `docker compose down -v`; không tự dọn build/graph cũ.

## Xử lý lỗi

```powershell
docker compose logs --tail 80 osrm gis-service
docker compose ps osrm gis-service
Get-Content data/osrm/hcm/active.txt
Get-PSDrive C,D
docker stats --no-stream ecoalert_osrm ecoalert_gis_service
```

- **Graph missing/incomplete**: chạy prepare-hcm.ps1, đọc lỗi đầu tiên; không tạo marker ready bằng tay. Sau prepare restart OSRM, đợi healthy rồi restart GIS.
- **OOM / exit 137**: chỉ chạy một job, kiểm Docker RAM/headroom + disk; HCM đã chạy với limit ở trên. Không quay lại extract toàn Việt Nam, không tự tắt service khác/tăng cấu hình toàn Docker.
- **Thiếu disk**: cần chỗ cho source/candidate/old/new graph. Chọn data dir ổ D hoặc ổ đủ chỗ; giữ dữ liệu cũ cho tới khi người dùng quyết định dọn.
- **Stale lock sau SIGKILL/OOM**: trước tiên kiểm `docker ps` và xác nhận không còn osrm-tools/osrm-prepare nào chạy. Chỉ khi đã xác minh mới bỏ **thư mục rỗng chính xác** `data/osrm/hcm/.graph-prepare-lock` bằng `Remove-Item -LiteralPath 'D:\KhoaLuanTotNghiep\EcoAlert\data\osrm\hcm\.graph-prepare-lock'` (không -Recurse). Không xóa graph/build. File Windows `.prepare-hcm.lock` có thể còn nhưng handle đã đóng sẽ cho chạy lại.
- **503 readiness**: thiếu coverage/graph hoặc OSRM chưa ready; kiểm mount cùng HCM data root và DNS osrm.
- **422**: endpoint ngoài polygon phục vụ; không gửi sang server công cộng.
- **404**: không có tuyến/điểm snap trong bán kính hỗ trợ; không nối đường thẳng.
- **502/504**: provider lỗi/kết nối/timeout hoặc response không hợp lệ; giữ thông báo rõ, kiểm OSRM health/log. Không fallback công cộng.
- **Mobile không hiện tuyến**: kiểm LAN API URL, reload Expo, quyền GPS, tọa độ endpoint thuộc vùng; đọc lỗi hiển thị trong app. Không coi gateway localhost reachable là điện thoại đã kết nối được.

## Files triển khai

- Runtime/config: `docker-compose.yml`, `.env.example`, `.gitignore`, `.gitattributes`, `README.md`.
- Preparation: `scripts/osrm/Dockerfile.tools`, `hcm-region.json`, `extract-hcm.py`, `prepare-hcm.ps1`, `prepare.sh`, `validate-graph.sh`, `serve.sh`, `healthcheck.sh`.
- GIS: `backend/gis-service/.env.example`, `package.json`, `package-lock.json`, `src/config/env.config.ts`, `src/app.ts`, `src/controllers/gis.controller.ts`, `src/services/gis.service.ts`, `osrm-routing.service.ts`, `routing-coverage.ts`, `src/tests/osrm-routing.test.ts`, `routing-coverage.test.ts`.
- Mobile: `mobile/src/screens/officer/OfficerOperationalMap.tsx`, `mobile/tests/officer-stitch.test.cjs`; `mobile/.env` chỉ cập nhật LAN local, bị Git ignore.
- Web compatibility từ đợt OSRM trước: `frontend/src/services/services.ts`, `frontend/src/features/officer/pages/OfficerReportDetail.tsx`, `frontend/src/services/officer-routing.test.ts`, `frontend/package.json`.
- Integration: `scripts/osrm/integration.mjs`, `scripts/osrm/mobile-integration.cjs`.

Không commit/push/merge tự động. Giữ nguyên những thay đổi local không thuộc định tuyến.
