import type { NotificationItem } from "../types/notification";
// API is the canonical formatter; this exact-template fallback also covers cached legacy pages.
const catalog: Record<string, [string, string]> = {
  REPORT_RECEIVED: [
    "Báo cáo của bạn đã được tiếp nhận",
    "EcoAlert đã ghi nhận báo cáo điểm rác của bạn. Báo cáo đang chờ kiểm tra và xử lý.",
  ],
  AI_ANALYZED: [
    "Đã có kết quả phân tích báo cáo",
    "Hệ thống đã hoàn tất phân tích hình ảnh điểm rác bạn gửi. Kết quả đang chờ xác minh.",
  ],
  VERIFIED: [
    "Báo cáo đã được xác minh",
    "Báo cáo điểm rác của bạn đã được xác minh và đang chờ phân công cán bộ xử lý.",
  ],
  ASSIGNED: [
    "Đã phân công cán bộ xử lý",
    "Báo cáo điểm rác của bạn đã được giao cho cán bộ phụ trách. Bạn có thể theo dõi tiến độ trong ứng dụng.",
  ],
  OFFICER_STARTED_HANDLING: [
    "Báo cáo đang được xử lý",
    "Cán bộ phụ trách đã bắt đầu xử lý điểm rác bạn phản ánh.",
  ],
  OFFICER_ARRIVED: [
    "Cán bộ đã đến hiện trường",
    "Cán bộ đã xác nhận có mặt tại vị trí điểm rác để thực hiện xử lý.",
  ],
  RESOLVED: [
    "Điểm rác đã được xử lý",
    "Cán bộ đã gửi kết quả và hình ảnh sau xử lý. Báo cáo đang chờ quản trị viên kiểm tra.",
  ],
  CLOSED: [
    "Báo cáo đã hoàn tất",
    "Kết quả xử lý điểm rác đã được xác nhận. Cảm ơn bạn đã góp phần giữ gìn môi trường xanh sạch.",
  ],
  REJECTED: [
    "Báo cáo chưa được chấp thuận",
    "Báo cáo của bạn chưa được chấp thuận sau khi kiểm tra. Nhấn để xem thông tin chi tiết.",
  ],
  OFFICER_ASSIGNED: [
    "Bạn có nhiệm vụ mới",
    "Một báo cáo điểm rác đã được phân công cho bạn. Vui lòng xem chi tiết và bắt đầu xử lý.",
  ],
  OFFICER_CLOSED: [
    "Nhiệm vụ đã được xác nhận hoàn tất",
    "Quản trị viên đã kiểm tra và đóng báo cáo bạn xử lý.",
  ],
  ADMIN_VERIFICATION: [
    "Có báo cáo mới cần kiểm tra",
    "Một báo cáo điểm rác đang chờ xác minh. Vui lòng kiểm tra thông tin trước khi phân công.",
  ],
  ADMIN_REVIEW: [
    "Có kết quả xử lý cần kiểm tra",
    "Cán bộ đã gửi kết quả và hình ảnh sau xử lý. Vui lòng kiểm tra trước khi đóng báo cáo.",
  ],
  STATUS_UPDATE: [
    "Cập nhật trạng thái báo cáo",
    "Báo cáo của bạn có cập nhật. Nhấn để xem thông tin chi tiết.",
  ],
  GENERAL: [
    "Thông báo từ EcoAlert",
    "Bạn có một thông báo trong ứng dụng. Vui lòng kiểm tra thông tin chi tiết.",
  ],
};
const legacy: Record<string, string> = {
  "Alert Analyzed": "AI_ANALYZED",
  "Officer started handling your report": "OFFICER_STARTED_HANDLING",
  "Officer arrived at the scene": "OFFICER_ARRIVED",
  "Incident resolved": "RESOLVED",
  "Incident closed": "CLOSED",
  "New incident assigned": "OFFICER_ASSIGNED",
  "Incident ready for review": "ADMIN_REVIEW",
  "Alert Status Update": "STATUS_UPDATE",
};
export function notificationPresentation(item: NotificationItem) {
  let type =
    item.type && Object.hasOwn(catalog, item.type)
      ? item.type
      : Object.hasOwn(legacy, item.title)
        ? legacy[item.title]
        : "GENERAL";
  if (!item.type && item.title === "Alert Status Update") {
    const match = item.message.match(
      /^Your alert [a-f\d]{24} is now (VERIFIED|REJECTED|ASSIGNED|IN_PROGRESS|RESOLVED|CLOSED)$/i,
    );
    if (match)
      type =
        match[1].toUpperCase() === "IN_PROGRESS"
          ? "OFFICER_STARTED_HANDLING"
          : match[1].toUpperCase();
  }
  const [title, fallback] = catalog[type];
  const safe =
    item.title === title &&
    item.message.startsWith(fallback) &&
    !/[a-f\d]{24}|[a-f\d]{8}-[a-f\d-]{15,}|\b[A-Z]+(?:_[A-Z]+)+\b|[<>@]|\b(?:UNCLASSIFIED|ASSIGNED|VERIFIED|RESOLVED|CLOSED|REJECTED|PENDING|bearer|token)\b/i.test(
      item.message,
    );
  const tone = ["RESOLVED", "CLOSED", "OFFICER_CLOSED"].includes(type)
    ? "success"
    : type === "REJECTED"
      ? "danger"
      : [
            "OFFICER_STARTED_HANDLING",
            "OFFICER_ARRIVED",
            "ASSIGNED",
            "AI_ANALYZED",
          ].includes(type)
        ? "info"
        : "attention";
  return { title, message: safe ? item.message : fallback, type, tone };
}
