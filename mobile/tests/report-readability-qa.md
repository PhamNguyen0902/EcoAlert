# Mobile report readability — 2026-10-02

Branch: `feature/mobile-field-capture`. Không merge `main`.

Code và kiểm thử bên dưới đã thực hiện. **P0 orientation trên iPhone thật chưa được xác nhận**: người dùng đã xác nhận dùng iPhone nhưng chưa cung cấp file ảnh gốc bị xoay; môi trường hiện tại không có thiết bị iPhone. Build bundle iOS không thay thế kiểm thử camera/native EXIF.

## 1. Nguyên nhân orientation và cách sửa

Luồng trước đây: `takePictureAsync({skipProcessing:false})` → copy nguyên file camera → lưu `picture.width/height` → tạo ảnh watermark bằng ViewShot → upload ảnh original. Không có bước chuẩn hóa pixel/EXIF trong app. App khóa màn hình portrait và CameraView chưa bật `responsiveOrientationWhenOrientationLocked` trên iOS. Metadata/kích thước camera và cách decoder hiển thị ảnh có thể khác nhau.

Đã bật responsive orientation cho camera iPhone; sau capture gọi `normalizeFieldCaptureImage`. Expo ImageManipulator SDK 57 decode/chuẩn hóa orientation trước khi render và lưu JPEG mới, không dùng rotate 90° cố định, crop hay resize. Draft lấy dimensions từ file đã chuẩn hóa, không dùng dimensions cũ của camera.

Nguồn: [Expo Camera SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/camera/), [Expo ImageManipulator SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/). Native iOS module đã được kiểm tra: `ImageFixOrientationTransformer` được chạy khi load ảnh.

Chưa có ảnh lỗi của người dùng nên chưa thể kết luận file gốc đó có pixel bị xoay hay chỉ metadata/UI hiển thị sai. Ảnh kiểm thử racthai.jpg hiển thị đúng chiều ngang; không dùng nó để suy ra ảnh camera iPhone cũng đã được xác nhận.

Luồng mới: camera → normalize → persist normalized original → watermark từ original đó → upload original → YOLO → bbox trên chính original đó. Bbox không cần xoay thêm trên UI. Ảnh/bbox báo cáo cũ không được sửa hồi tố.

## 2. UI bước 3

- Viewer dùng kích thước ảnh thật, `contain`, nền #050D17, radius 16; portrait cao tối đa 440, landscape 240–320.
- Tất cả bbox hợp lệ vẫn được vẽ. Hơn 5 vùng hoặc các vùng chồng nhau dùng badge số, không dùng hàng loạt full-text labels.
- Box nhỏ dùng badge tối thiểu 18×18. Chạm bbox/badge làm nổi box và hiện một label đầy đủ; chạm lại bỏ chọn.
- Rectangle 1.5px, selected 3px; opacity nền 0.025.
- Status card nhỏ; badge “ĐÃ PHÂN TÍCH”; active progress xanh, completed xanh nhạt, future slate.
- Summary nhóm theo class: số vùng và confidence lớn nhất, không gọi là accuracy. 390px trở lên hai cột; 360px một cột.
- Confidence: ≥70% xanh, 45–69% cyan, 30–44% amber, thấp hơn muted. Không đổi threshold model.

## 3. UI bước 4 và dữ liệu semantic

- Dùng ảnh watermark nếu có, fallback ảnh original khi file watermark lỗi; `contain`, cao tối đa 320, không vẽ bbox lần nữa.
- Category/severity nằm trong một hàng thông tin nhỏ. Có kết quả thì hiển thị đúng API; thiếu thì cyan “Đang hoàn tất”/“Đang đánh giá”. `UNCLASSIFIED` là “Chờ cán bộ xác nhận”, không phải một category đã hoàn tất.
- Bước 3 đã await `validateImageSemantics` trước khi set state VALID. Không phải chuyển bước sớm trong lúc semantic còn đang chạy.
- Nếu API semantic lỗi/timeout thì code catch về null, vẫn giữ kết quả YOLO theo logic có sẵn. YOLO không cung cấp severity và không thay thế semantic category. AI sau submit vẫn chạy theo pipeline backend hiện tại.
- Điểm cần theo dõi, không sửa ngoài scope: mobile API timeout chung 8 giây trong `api/client.ts`, trong khi request OpenRouter có timeout 15 giây. Đây là nguy cơ timeout, chưa có log chứng minh nó là nguyên nhân của request iPhone cụ thể.
- Card địa điểm/địa chỉ dài wrap bình thường, description và checkbox cuộn được lên trên CTA.
- Footer là sibling không shrink của ScrollView flex:1, không absolute overlay; CTA đo được 52px/54px. Không cần paddingBottom 140 để bù overlay không tồn tại.

## 4. Expo gear

Người dùng xác nhận bánh răng thuộc Expo Go. Search source không thấy app render Cog/gear/DevMenu. Không sửa app để xóa control của môi trường development; chưa chạy production app trên điện thoại để xác minh bằng screenshot.

## 5. Kết quả kiểm thử

- `npx tsc --noEmit`: pass, 0 lỗi.
- `npm run test:vision`: 21 tests pass, 0 fail. Bao gồm mapping bbox, nhóm/count/max confidence, portrait/landscape height, overlap/13 labels, confidence màu, API boundary normalization và release khi lỗi. Unit test normalization dùng native API stub, **không chứng minh EXIF decoder chạy trên iPhone**.
- Expo export bundle iOS: pass, 4371 modules. Android: pass, 4369 modules. Không phải native build/device test.
- So sánh AST với HEAD: các hàm analyze, submit, canSubmit, validation, GPS, offline queue, watermark generation giữ nguyên. `takePicture` chỉ thêm normalization/dimensions mới.
- Browser preview render component thật qua React Native Web. Dữ liệu tổng hợp chỉ ở harness tạm ngoài repository để test layout, không thêm mock API/detections vào app.

| Kiểm thử layout | Kết quả |
| --- | --- |
| 360×800, 390×844, 412×915, 430×932, portrait | Viewer 440px; không tràn ngang; CTA 52/54px |
| 1, 4, 13 detections, landscape | Viewer 240px; summary đúng số; không tràn ngang |
| 13 overlapping boxes, chọn bbox | Badge số; một floating full label; box selected |
| Grouping/low confidence | 75/52/38/24% đúng màu; không lọc bớt data |
| Step 3 → Step 4 | Chuyển bằng nút thật; draft/detections giữ nguyên |
| Category/severity pending/complete, UNCLASSIFIED | Không fake; trạng thái nhỏ, readable |
| Location/địa chỉ dài, scroll cuối | Wrap; textarea + checkbox nằm trên CTA ở cả 4 widths |

Kiểm thử model thật: `GET http://localhost:8001/health` báo model_loaded=true. `POST /detect` với `racthai.jpg` (1471×877) trả 24 vùng. Đã đưa chính bbox API trả về vào viewer và kiểm tra một vùng túi nhựa được chọn trên ảnh. Không thay model, confidence threshold, dữ liệu hay API backend.

Screenshots QA nằm trong thư mục tạm local `C:/Users/Hii/AppData/Local/Temp/ecoalert-report-preview-20261002/` (`step3-*.png`, `step4-bottom-*.png`, `real-yolo-24-selected.png`), không commit ảnh/dữ liệu giả.

## 6. File thay đổi

- `mobile/package.json`, `mobile/package-lock.json`: Expo-compatible ImageManipulator và test script.
- `mobile/src/utils/fieldCaptureImage.ts`: normalization trước persist/upload.
- `mobile/src/utils/visionBoundingBox.ts`: height/label policy/confidence presentation; bbox transform cũ giữ nguyên.
- `mobile/src/components/vision/WasteDetectionImage.tsx`: adaptive image + numbered/selectable boxes.
- `mobile/src/components/vision/WasteDetectionResults.tsx`: compact grouped cards.
- `mobile/src/features/report/components/ReportEvidenceImage.tsx`: ảnh confirmation contain + fallback.
- `mobile/src/features/report/components/ReportBottomActions.tsx`: footer không shrink.
- `mobile/src/features/report/components/ReportProgress.tsx`: active/completed colors.
- `mobile/src/features/report/screens/ReportCameraScreen.tsx`: camera orientation và normalized dimensions.
- `mobile/src/features/report/screens/ReportImageValidationScreen.tsx`: compact Step 3, scroll/footer layout.
- `mobile/src/features/report/screens/ReportConfirmScreen.tsx`: Step 4 image, actual/pending metadata, scroll/footer.
- `mobile/tests/fieldCaptureImage.test.cjs`, `mobile/tests/visionBoundingBox.test.cjs`: regression tests.
- File QA này.

Context/types/AlertDetail đã audit nhưng không cần sửa. Các thay đổi backend/frontend có sẵn của người dùng được giữ nguyên, không stage/commit trong task này.

## 7. Cần xác nhận trên iPhone trước khi chốt P0

1. Cài dependencies, chạy `npx expo start -c` từ mobile, reload Expo Go.
2. Chụp lại ảnh mới bằng camera: portrait, landscape trái, landscape phải, kể cả bật portrait rotation lock. Không chỉ mở lại ảnh/bbox cũ.
3. Kiểm tra ảnh gốc bước review, ảnh YOLO bước 3, watermark bước 4 cùng đúng chiều; bbox ôm đúng vật thể.
4. Kiểm tra keyboard mở/đóng và safe area thật không che textarea/footer; xác minh production build không có control Expo Go.
5. Nếu còn xoay, cung cấp file camera gốc để inspect EXIF + dimensions; không xoay riêng UI khi YOLO vẫn dùng file cũ.
