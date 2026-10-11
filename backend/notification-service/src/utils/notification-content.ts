export const statusLabels: Record<string, string> = {
  PENDING: "Đang chờ tiếp nhận",
  AI_ANALYZING: "Đang phân tích",
  VERIFIED: "Đã xác minh",
  ASSIGNED: "Đã phân công",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã hoàn tất",
  REJECTED: "Không được chấp thuận",
};

export const contentCatalog = {
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
} as const;
export type ContentType = keyof typeof contentCatalog;
export interface NotificationContent {
  title: string;
  message: string;
  type: ContentType;
}

/** Titles come from user input: never interpolate credentials, IDs, HTML or technical codes. */
export function safeAlertTitle(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const title = value.replace(/\s+/g, " ").trim();
  if (
    !title ||
    /[<>@]|https?:|bearer|token|[a-f\d]{24}|[a-f\d]{8}-[a-f\d-]{15,}|\b[A-Z]+(?:_[A-Z]+)+\b|\b(?:UNCLASSIFIED|ASSIGNED|VERIFIED|RESOLVED|CLOSED|REJECTED|PENDING)\b/i.test(
      title,
    )
  )
    return;
  return Array.from(title).length > 90
    ? `${Array.from(title)
        .slice(0, 87)
        .join("")
        .replace(/\s+\S*$/, "")}…`
    : title;
}
export function contentForType(
  type: ContentType,
  alertTitle?: unknown,
): NotificationContent {
  const [title, body] = contentCatalog[type];
  const name = safeAlertTitle(alertTitle);
  return { title, message: name ? `${body} Báo cáo: “${name}”.` : body, type };
}
export function buildNotificationContent(input: {
  eventType: string;
  status?: string;
  recipientRole: "CITIZEN" | "OFFICER" | "ADMIN";
  alertTitle?: string;
}): NotificationContent | null {
  const { eventType: event, recipientRole: role } = input;
  const status = input.status?.toUpperCase();
  let type: ContentType | undefined;
  if (role === "CITIZEN") {
    type = (
      {
        "alert.created": "REPORT_RECEIVED",
        "ai.analyzed": "AI_ANALYZED",
        "officer.assigned": "ASSIGNED",
        "alert.started": "OFFICER_STARTED_HANDLING",
        "alert.arrived": "OFFICER_ARRIVED",
        "alert.resolved": "RESOLVED",
        "alert.closed": "CLOSED",
      } as Record<string, ContentType>
    )[event];
    if (
      event === "alert.updated" &&
      (status === "VERIFIED" || status === "REJECTED")
    )
      type = status;
  } else if (role === "OFFICER") {
    if (event === "officer.assigned") type = "OFFICER_ASSIGNED";
    if (event === "alert.closed") type = "OFFICER_CLOSED";
  } else {
    if (event === "alert.created") type = "ADMIN_VERIFICATION";
    if (event === "alert.resolved") type = "ADMIN_REVIEW";
  }
  return type && typeof type === "string" && Object.hasOwn(contentCatalog, type)
    ? contentForType(type, input.alertTitle)
    : null;
}

// Exact titles verified in the previous consumer. Never infer an event from a vague keyword.
const legacyTitles: Record<string, ContentType> = {
  "Alert Analyzed": "AI_ANALYZED",
  "Officer started handling your report": "OFFICER_STARTED_HANDLING",
  "Officer arrived at the scene": "OFFICER_ARRIVED",
  "Incident resolved": "RESOLVED",
  "Incident closed": "CLOSED",
  "New incident assigned": "OFFICER_ASSIGNED",
  "Incident ready for review": "ADMIN_REVIEW",
  "Alert Status Update": "STATUS_UPDATE",
};
export function formatNotificationContent(record: {
  type?: string;
  eventType?: string;
  title?: string;
  message?: string;
  recipientId?: string;
  alertTitle?: string;
  recipientRole?: string;
}): NotificationContent {
  if (record.type && Object.hasOwn(contentCatalog, record.type))
    return contentForType(record.type as ContentType, record.alertTitle);
  if (record.eventType) {
    const content = buildNotificationContent({
      eventType: record.eventType,
      recipientRole:
        record.recipientId === "admins"
          ? "ADMIN"
          : record.recipientId === "officers"
            ? "OFFICER"
            : "CITIZEN",
    });
    if (content) return content;
  }
  let type = Object.hasOwn(legacyTitles, record.title || "")
    ? legacyTitles[record.title || ""]
    : undefined;
  if (
    record.title === "Incident closed" &&
    (record.recipientId === "officers" || record.recipientRole === "OFFICER")
  )
    type = "OFFICER_CLOSED";
  if (record.title === "Alert Status Update") {
    const match = record.message?.match(
      /^Your alert [a-f\d]{24} is now (VERIFIED|REJECTED|ASSIGNED|IN_PROGRESS|RESOLVED|CLOSED)$/i,
    );
    if (match)
      type =
        (
          { IN_PROGRESS: "OFFICER_STARTED_HANDLING" } as Record<
            string,
            ContentType
          >
        )[match[1].toUpperCase()] || (match[1].toUpperCase() as ContentType);
  }
  return contentForType(type || "GENERAL");
}
