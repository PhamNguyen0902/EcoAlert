# EcoAlert Officer Stitch — báo cáo triển khai

Ngày: 12/10/2026. Branch: `feature/mobile-field-capture`. Baseline: `41f4595`.

## 1. Chín màn hình đã tích hợp

| Màn hình | Kết quả triển khai |
| --- | --- |
| Dashboard | Header field operations, tên cán bộ thật, lời chào theo giờ, hero contour SVG, ba KPI từ nhiệm vụ, nhiệm vụ ưu tiên theo severity, bộ lọc và hoạt động từ timestamp thật. Không gọi toàn bộ lịch sử là nhiệm vụ hôm nay. |
| Danh sách nhiệm vụ | Search tiếng Việt không dấu theo tiêu đề/địa chỉ/ID trong dữ liệu đã tải, status pills, ảnh thật, metadata, thống kê thật. Nút nổi mở bản đồ, không mở camera để bỏ qua check-in. |
| Chi tiết sự cố | Ảnh minh chứng lớn đầu màn hình, summary/địa chỉ/assignment, đúng một card AI tổng quan, map preview, timeline sáu bước, ghi chú hiện có, CTA theo trạng thái và quyền sở hữu. |
| Bản đồ tác nghiệp | Native map gần toàn màn hình, search/filter, marker nhiệm vụ, GPS thiết bị khi yêu cầu, controls, selected-task sheet, polyline GIS/OSRM thật và Google Maps fallback. Admin giữ implementation cũ. |
| Điểm danh GPS | Map, metadata GPS/sai số/khoảng cách thẳng/thời gian, permission/error/retry, lấy GPS mới lúc xác nhận; chỉ server được quyết định verified. |
| Thu thập chứng cứ | Ảnh trước/sau thật, camera cũ, review/retake/confirm, form controlled và field xử lý cũ, CTA ngoài ScrollView, keyboard avoidance và khóa gửi trùng. |
| Đã gửi kết quả | Chỉ hiện thành công cho hồ sơ thuộc cán bộ có trạng thái server RESOLVED/CLOSED, receipt và ảnh thật, timeline chờ Admin, điều hướng bỏ form đã gửi. |
| Cá nhân | Avatar/initials, tên/email/role/khu vực thật, thống kê nhiệm vụ, ca trực hiện có, quyền GPS/thông báo, theme, version app và logout có xác nhận. |
| Thông báo | API và localization hiện có, phân trang, all/unread/read, mark read/all, icon theo sự kiện, short reference hợp lệ và deep link Officer. |

Navigation vẫn có đúng ba tab: **Nhiệm vụ / Bản đồ / Cá nhân**. Các màn phụ nằm trong Officer stack. Các route theo incident dùng `getId` để tránh tái sử dụng form/ảnh của nhiệm vụ khác.

## 2. Các file có sẵn đã sửa

- `src/navigation/OfficerTabNavigator.tsx`
- `src/navigation/types.ts`
- `src/screens/officer/OfficerTasksScreen.tsx`
- `src/screens/officer/OfficerAlertDetailScreen.tsx`
- `src/screens/officer/OfficerMapScreen.tsx`
- `src/screens/officer/OfficerProfileScreen.tsx`
- `src/screens/officer/OfficerResolutionScreen.tsx`
- `tests/officer-profile.test.cjs`
- `tests/officer-resolution.test.cjs`

Các đường dẫn trong báo cáo này tương đối với thư mục `mobile`.

## 3. Các file mới

- `src/screens/officer/OfficerTaskListScreen.tsx`
- `src/screens/officer/OfficerOperationalMap.tsx`
- `src/screens/officer/OfficerGpsCheckInScreen.tsx`
- `src/screens/officer/OfficerResolutionSubmittedScreen.tsx`
- `src/screens/officer/OfficerNotificationsScreen.tsx`
- `src/components/officer/OfficerUI.tsx`
- `src/components/officer/OfficerTaskCard.tsx`
- `src/components/officer/OfficerTaskFilters.tsx`
- `src/components/officer/OfficerTimeline.tsx`
- `src/components/officer/OfficerEvidenceComparison.tsx`
- `src/components/officer/OfficerProfileTools.tsx`
- `src/components/officer/OfficerEntrance.tsx`
- `src/utils/officerPresentation.ts`
- `src/api/officerRouting.ts`
- `src/hooks/useOfficerPosition.ts`
- `tests/officer-stitch.test.cjs`
- `tests/officer-stitch-qa.md`
- `docs/officer-stitch-implementation.md`

## 4. Tái sử dụng và bảo toàn nghiệp vụ

Tái sử dụng `useOfficerTasks` cùng query key/all-pages, `useAlert`, `useProfile`, `useStartHandling`, `useConfirmArrival`, `useResolveIncident`, `useUploadMedia`, shift/service-area/notification hooks, `OverallAiAnalysisCard`, `EvidenceImageFrame`, `OfficerResolutionCamera`, `Button`, `Card`, `Input`, civic theme và Reduce Motion hook.

Luồng giữ nguyên:

`ASSIGNED → startHandling → IN_PROGRESS → confirmArrival bằng GPS mới → server verified → camera/review/confirm → upload → resolve → RESOLVED → Admin kiểm tra/đóng → CLOSED`.

Start handling và arrival là hai mutation độc lập. Ownership được kiểm tra ở UI cho detail/GPS/resolution/success; backend authorization không đổi. Không có tự động CLOSED, không có auto-accept mới. Upload/resolve dùng submitter cũ có reuse upload khi retry và synchronous duplicate lock. Form không rời màn hình khi đang gửi; chỉ replace sau khi mutation thành công và navigation guard được gỡ.

Camera gốc không có thay đổi nội dung: GPS Highest, `takePictureAsync(skipProcessing:false)`, `normalizeFieldCaptureImage`, `persistOriginalFieldImage`, metadata và validation giữ nguyên. Không sửa EXIF/bbox/persistence trong đợt này.

## 5. Routing và GPS

- Tái sử dụng `GET /v1/gis/route` với startLat/startLng/endLat/endLng của GIS service đang có; GIS gọi OSRM driving.
- Adapter kiểm tra distance/duration và GeoJSON LineString `[longitude, latitude]`, hỗ trợ cancellation/timeout; map không vẽ fallback đường thẳng giả.
- Distance/ETA tuyến chỉ lấy từ response, ghi rõ không tính giao thông trực tiếp. Không tuyên bố turn-by-turn/voice navigation.
- Google Maps external vẫn hoạt động khi route/GPS lỗi, có chống mở trùng.
- iOS dùng native default MapKit; Android dùng Google provider. Không thay đổi cấu hình API key native.
- GPS yêu cầu foreground và fix mới, không giả lập vị trí, không dùng last-known làm check-in; bỏ kết quả stale/background/unmounted, có timeout và thông báo quyền bị từ chối.
- Backend có check-in radius và max accuracy cấu hình theo deployment nhưng chưa có API công bố policy cho mobile. Vì vậy **không hardcode vòng 100m hoặc kết luận trong/ngoài vùng ở client**. Vòng trên màn GPS là sai số thiết bị, có nhãn rõ. Backend kiểm tra mỗi lần confirm; khi bị từ chối, UI khóa xác nhận cho đến khi người dùng lấy lại GPS. Yêu cầu disable trước lần gửi khi ngoài radius chưa thể xác minh đủ từ contract hiện tại.

## 6. Thông báo

Dữ liệu thật qua notification hooks/service và localization sẵn có. Chạm thông báo mark read rồi mở `OfficerAlertDetail` chỉ khi `alertId` là Mongo ObjectId hợp lệ; không dùng UUID `eventId` và không đưa Officer sang Citizen route. Có sync lock chống double tap. Bộ lọc nêu rõ phạm vi các trang đã tải. Bell hiển thị unread badge thật (9+ khi nhiều), không tạo sự kiện mẫu.

## 7. Visual QA và responsive

Đã triển khai composition theo ảnh tổng hợp: compact field header, hero/KPI, rich task cards, evidence-first detail, timeline dọc, dark native map/controls/sheet, GPS verification panel, before/after, success emblem, profile và notification cards. Giữ dark/light theme, safe-area, scroll, keyboard avoidance, text wrap và touch targets. Motion fade/scale ngắn và map camera tôn trọng Reduce Motion, không có animation loop nặng trên camera/map.

**Chưa có screenshot runtime để so sánh pixel.** Máy Windows này không có iPhone/Android/simulator kết nối. Ảnh tham chiếu chỉ là composite độ phân giải thấp; đã hỏi người dùng các export riêng. Không tuyên bố pixel-perfect, không tuyên bố tất cả kích thước/font scale đã kiểm tra trên thiết bị. Visual QA nghiêm ngặt vẫn là hạng mục cần làm trên điện thoại.

Checklist thiết bị trong `tests/officer-stitch-qa.md`: 360/390/430dp, iPhone mini/Pro Max, dark/light, font scale, keyboard, safe-area, long address, offline/error/empty, ownership, GPS inside/outside theo policy deployed, camera permission/capture/orientation, upload retry, live routing, notification deep link và logout.

## 8. Kết quả kiểm tra cuối

| Kiểm tra | Kết quả |
| --- | --- |
| Baseline `npx tsc --noEmit` | Pass |
| Baseline toàn bộ tests | 174 pass, 0 fail |
| Cuối `npx tsc --noEmit` | Pass |
| Cuối `node --test tests/*.test.cjs` | 186 pass, 0 fail, 0 skipped |
| Android Expo export | Pass, 4431 modules; `dist/officer-stitch-android` |
| iOS Expo export | Pass, 4433 modules; `dist/officer-stitch-ios` |
| `git diff --check` | Pass |

Thêm 12 regression tests về ownership, timeline thật, search, route contract/GeoJSON/cancellation, một AI card, GPS fresh/denied/stale/unmounted/lock, success server-only, navigation ba tabs/Admin branch, localized notifications/valid alertId và controlled resolution/upload-once/success navigation. Test profile và resolution cũ được cập nhật fixture/layout assertion theo UI mới; không bỏ validation nghiệp vụ để làm test pass.

Đây là unit/render-harness/static regression và bundle checks; **không thay thế E2E backend/OSRM/GPS/camera trên máy thật**, cũng không phải native Xcode/Gradle build. Camera/permission/inside-outside radius/live notification delivery và acceptance của UI trên thiết bị vẫn cần kiểm tra thủ công.

## 9. Giới hạn dữ liệu và phạm vi

Không fake: staff ID/verified-government identity, trọng lượng đo chính thức, rating/response-time/completion percentage, khoảng cách khi chưa có GPS, ETA khi chưa có route, ngày giờ, ảnh sạch hoặc background-GPS toggle. Backend resolution DTO không có weight field nên không thêm control có vẻ đã lưu số kg. Không thêm backend feature/API/mock/dependency mới.

## 10. Git và thay đổi local được giữ nguyên

Các commit triển khai local:

- `d9a50b5` — design system.
- `65ba2aa` — dashboard/tasks.
- `0283ebf` — detail/map.
- `4ac7f66` — GPS check-in.
- `37cf1b6` — evidence/resolution.
- `0b5a7ea` — success/profile/notifications/navigation.
- Commit cuối `fix(mobile): refine officer stitch visual fidelity` lưu unread badge, tests và báo cáo này; SHA xem `git log -1` sau commit.

Giữ nguyên, không stage vào Officer commits:

- `src/screens/admin/AdminIncidentsScreen.tsx` (local: 53 insertions/2 deletions).
- `src/screens/citizen/AlertDetailScreen.tsx` (local: 241 deletions).
- `tests/admin-logout.test.cjs` (untracked từ trước).
- `tests/alert-detail-ai.test.cjs` (untracked từ trước).

Không pull/reset, không push, không merge main, không tạo PR. Không thay đổi backend, Citizen navigator/ReportFlow hoặc Admin navigator. Shared Officer map `mode="admin"` giữ nhánh implementation cũ; regression được kiểm tra trong bộ tests.
