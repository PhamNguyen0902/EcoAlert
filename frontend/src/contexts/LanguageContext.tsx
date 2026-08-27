import React, { createContext, useContext, useState } from "react";

export type Language = "vi" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Topbar & Nav
    "nav.dashboard": "Tổng quan",
    "nav.users": "Quản lý Người dùng",
    "nav.officers": "Quản lý Cán bộ",
    "nav.reports": "Quản lý Báo cáo",
    "nav.gis": "Bản đồ GIS",
    "nav.monitoring": "Giám sát Hệ thống",
    "nav.analytics": "Thống kê Nâng cao",
    "nav.audit": "Nhật ký Hoạt động",
    "nav.settings": "Cấu hình Hệ thống",
    "nav.home": "Trang chủ",
    "nav.report_incident": "Gửi báo cáo",
    "nav.my_reports": "Báo cáo của tôi",
    "nav.profile": "Hồ sơ cá nhân",
    "nav.logout": "Đăng xuất",
    "nav.signin": "Đăng nhập",
    "nav.portal": "Cổng Quản trị EcoAlert",

    // Hero Section
    "hero.protecting": "Bảo vệ ",
    "hero.our_environment": "Môi trường của Chúng ta ",
    "hero.subtitle":
      "Báo cáo sự cố môi trường ngay lập tức. Phân loại bằng AI. Theo dõi GIS thời gian thực.",
    "hero.btn_report": "Báo cáo Sự cố Môi trường",
    "hero.btn_explore": "Khám phá Sự cố Xung quanh",

    // Citizen Footer
    "footer.about_title": "Về EcoAlert",
    "footer.about_desc":
      "Hệ thống báo cáo và quản lý sự cố môi trường thông minh ứng dụng công nghệ AI & GIS thời gian thực.",
    "footer.quick_links": "Liên kết Nhanh",
    "footer.contact": "Liên hệ Hỗ trợ",
    "footer.address": "Thành phố Hồ Chí Minh, Việt Nam",
    "footer.phone": "Hotline: 1900 xxxx",
    "footer.rights": "Tất cả các quyền được bảo lưu.",

    // Statuses & Priority
    "status.all": "Tất cả",
    "status.pending": "Chờ xác minh",
    "status.in_progress": "Đang xử lý",
    "status.resolved": "Đã hoàn thành",
    "status.rejected": "Đã từ chối",
    "priority.low": "Thấp",
    "priority.medium": "Trung bình",
    "priority.high": "Cao",
    "priority.urgent": "Khẩn cấp",

    // Create Report Wizard
    "report_create.title": "Báo cáo Sự cố Môi trường",
    "report_create.subtitle":
      "Cung cấp thông tin chi tiết giúp cơ quan chức năng xử lý kịp thời",
    "report_create.step1": "Thông tin",
    "report_create.step2": "Vị trí",
    "report_create.step3": "Hình ảnh / Minh chứng",
    "report_create.step4": "Xác nhận",
    "report_create.field_title": "Tiêu đề báo cáo",
    "report_create.field_title_placeholder":
      "VD: Xả rác thải không đúng nơi quy định tại đường...",
    "report_create.field_category": "Danh mục sự cố",
    "report_create.field_description": "Mô tả chi tiết sự cố",
    "report_create.field_description_placeholder":
      "Mô tả chi tiết tình trạng, quy mô và tác động của sự cố...",
    "report_create.field_address": "Địa chỉ vị trí sự cố",
    "report_create.field_address_placeholder":
      "Nhập địa chỉ hoặc chọn vị trí trên bản đồ...",
    "report_create.map_instruction":
      "Nhấp vào bản đồ để chọn tọa độ chính xác của sự cố",
    "report_create.dropzone_text":
      "Kéo & thả ảnh vào đây hoặc nhấp để tải ảnh lên",
    "report_create.dropzone_subtext":
      "Hỗ trợ định dạng JPG, PNG, WEBP (Tối đa 10MB)",
    "report_create.ai_classification": "Phân loại tự động bằng AI",
    "report_create.submit_confirm": "Xác nhận & Gửi báo cáo",
    "report_create.submitting": "Đang gửi báo cáo...",

    // My Reports Page
    "my_reports.title": "Báo cáo của tôi",
    "my_reports.subtitle":
      "Theo dõi tiến độ xử lý các phản ánh môi trường bạn đã gửi",
    "my_reports.empty": "Bạn chưa gửi báo cáo nào",
    "my_reports.empty_desc":
      "Hãy đóng góp bảo vệ môi trường bằng cách gửi phản ánh đầu tiên.",
    "my_reports.btn_create": "Tạo báo cáo mới",
    "my_reports.delete_confirm_title": "Xác nhận xóa báo cáo",
    "my_reports.delete_confirm_desc":
      "Bạn có chắc chắn muốn xóa báo cáo này? Hành động này không thể hoàn tác.",

    // Alert Detail Page
    "alert_detail.title": "Chi tiết Báo cáo Sự cố",
    "alert_detail.timeline": "Lịch sử Tiến độ Xử lý",
    "alert_detail.location": "Vị trí địa lý",
    "alert_detail.comments": "Bình luận & Phản hồi",
    "alert_detail.add_comment": "Viết bình luận...",
    "alert_detail.submit_comment": "Gửi bình luận",

    // Officer Topbar & Titles
    "officer.dashboard": "Tổng quan Cán bộ",
    "officer.subtitle": "Theo dõi và xử lý các báo cáo sự cố môi trường",
    "officer.assigned": "Báo cáo được giao",
    "officer.pending": "Chờ xác minh",
    "officer.map": "Bản đồ giám sát",
    "officer.notifications": "Thông báo Cán bộ",
    "officer.stats": "Thống kê hiệu suất",
    "officer.details": "Chi tiết Báo cáo Cán bộ",

    // Officer Assigned & Pending Reports
    "officer_reports.search_placeholder":
      "Tìm kiếm theo tiêu đề, địa chỉ, người gửi...",
    "officer_reports.table_id": "Mã sự cố",
    "officer_reports.table_title": "Tiêu đề & Danh mục",
    "officer_reports.table_location": "Vị trí",
    "officer_reports.table_priority": "Mức độ",
    "officer_reports.table_status": "Trạng thái",
    "officer_reports.table_date": "Ngày báo cáo",
    "officer_reports.table_action": "Hành động",
    "officer_reports.btn_approve": "Duyệt & Tiếp nhận",
    "officer_reports.btn_reject": "Từ chối báo cáo",
    "officer_reports.reject_title": "Từ chối Báo cáo Sự cố",
    "officer_reports.reject_reason_label": "Lý do từ chối",
    "officer_reports.reject_reason_placeholder":
      "Nhập lý do chi tiết để thông báo cho người gửi...",
    "officer_reports.update_status_title": "Cập nhật Trạng thái Xử lý",
    "officer_reports.upload_evidence": "Tải ảnh minh chứng kết quả xử lý",
    "officer_reports.officer_notes": "Ghi chú của cán bộ",

    // Admin Dashboard & Pages
    "admin_users.title": "Quản lý Người dùng",
    "admin_users.subtitle":
      "Quản lý danh sách tài khoản người dân và quyền truy cập",
    "admin_users.col_name": "Họ và tên",
    "admin_users.col_email": "Email",
    "admin_users.col_role": "Vai trò",
    "admin_users.col_status": "Trạng thái",
    "admin_users.col_created": "Ngày tạo",
    "admin_users.create_title": "Tạo người dùng mới",
    "admin_users.role_citizen": "Người dân",
    "admin_users.role_officer": "Cán bộ",
    "admin_users.role_admin": "Quản trị viên",

    "admin_officers.title": "Quản lý Cán bộ Môi trường",
    "admin_officers.subtitle": "Phân công địa bàn và quản lý tài khoản cán bộ",
    "admin_officers.district": "Quận / Huyện phụ trách",
    "admin_officers.active_tasks": "Công việc đang xử lý",

    "admin_categories.title": "Quản lý Danh mục Sự cố",
    "admin_categories.subtitle":
      "Cấu hình các loại sự cố môi trường và biểu tượng",
    "admin_categories.col_name": "Tên danh mục",
    "admin_categories.col_priority": "Độ ưu tiên mặc định",

    "admin_monitoring.title": "Giám sát Hạ tầng Hệ thống",
    "admin_monitoring.subtitle":
      "Theo dõi thông số máy chủ, cơ sở dữ liệu và hiệu năng API",
    "admin_monitoring.cpu": "Tải CPU",
    "admin_monitoring.ram": "Sử dụng RAM",
    "admin_monitoring.db_status": "Kết nối Database",
    "admin_monitoring.latency": "Độ trễ API",
    "admin_monitoring.uptime": "Thời gian hoạt động (Uptime)",

    "admin_analytics.title": "Thống kê & Phân tích Nâng cao",
    "admin_analytics.subtitle":
      "Báo cáo xu hướng sự cố ô nhiễm và phân tích theo thời gian",
    "admin_analytics.export_pdf": "Xuất báo cáo PDF",
    "admin_analytics.export_excel": "Xuất báo cáo Excel",

    "admin_audit.title": "Nhật ký Hoạt động Hệ thống",
    "admin_audit.subtitle":
      "Theo dõi vết thao tác của người dùng và quản trị viên",
    "admin_audit.col_timestamp": "Thời gian",
    "admin_audit.col_actor": "Người thực hiện",
    "admin_audit.col_action": "Hành động",
    "admin_audit.col_ip": "Địa chỉ IP",
    "admin_audit.col_details": "Chi tiết",

    "admin_settings.title": "Cấu hình Hệ thống",
    "admin_settings.subtitle":
      "Tùy chỉnh thông số email, AI service và bộ lưu trữ",
    "admin_settings.smtp_title": "Cấu hình Email (SMTP)",
    "admin_settings.ai_title": "Cấu hình Dịch vụ AI",
    "admin_settings.storage_title": "Lưu trữ S3 / Cloudinary",

    // Dashboard Overview Stats
    "stats.total_users": "Tổng Người dùng",
    "stats.total_reports": "Tổng Báo cáo",
    "stats.active_officers": "Cán bộ Đang hoạt động",
    "stats.system_status": "Trạng thái Hệ thống",
    "stats.operational": "Hoạt động 100%",
    "stats.assigned_to_me": "Được giao cho tôi",
    "stats.pending_verification": "Chờ xác minh",
    "stats.in_progress": "Đang xử lý",
    "stats.resolved": "Đã hoàn thành",
    "stats.reports_by_status": "Báo cáo theo Trạng thái (Thực tế)",
    "stats.user_demographics": "Cơ cấu Người dùng (Thực tế)",
    "stats.category_distribution": "Phân bổ theo Danh mục (Thực tế)",
    "stats.recent_activity": "Hoạt động Gần đây",
    "stats.latest_reports_desc": "Các báo cáo mới nhất trên toàn hệ thống",
    "stats.no_recent_reports": "Chưa có báo cáo nào gần đây",
    "stats.quick_links": "Liên kết Nhanh",
    "stats.environmental_overview": "Tổng quan Môi trường",
    "stats.community_snapshot":
      "Bức tranh thời gian thực về tình hình phản ánh sự cố môi trường từ cộng đồng.",

    // Citizen Home & Maps
    "citizen.live_map": "Bản đồ Sự cố Thời gian thực",
    "citizen.map_desc":
      "Các phản ánh vi phạm môi trường theo khu vực địa lý của bạn",
    "citizen.filter_category": "Lọc theo Loại sự cố",
    "citizen.category_desc":
      "Nhấp vào loại sự cố để lọc vị trí tương ứng trên bản đồ",
    "citizen.nearby_incidents": "Sự cố Xung quanh bạn",
    "citizen.nearby_desc":
      "Các báo cáo sự cố môi trường mới nhất ở khu vực lân cận",
    "citizen.view_details": "Xem chi tiết",

    // Auth & Profile
    "auth.login_title": "Đăng nhập Hệ thống EcoAlert",
    "auth.login_subtitle": "Nhập tài khoản để tiếp tục",
    "auth.register_title": "Đăng ký Tài khoản Mới",
    "auth.register_subtitle":
      "Tham gia phản ánh bảo vệ môi trường cùng cộng đồng",
    "auth.email": "Địa chỉ Email",
    "auth.password": "Mật khẩu",
    "auth.confirm_password": "Xác nhận Mật khẩu",
    "auth.full_name": "Họ và tên",
    "auth.phone": "Số điện thoại",
    "auth.remember_me": "Ghi nhớ đăng nhập",
    "auth.forgot_password": "Quên mật khẩu?",
    "auth.no_account": "Chưa có tài khoản? Đăng ký ngay",
    "auth.has_account": "Đã có tài khoản? Đăng nhập ngay",
    "profile.title": "Hồ sơ cá nhân",
    "profile.change_password": "Đổi mật khẩu",
    "profile.old_password": "Mật khẩu hiện tại",
    "profile.new_password": "Mật khẩu mới",

    // Category Management
    "admin_categories.code_col": "Mã Code",
    "admin_categories.desc_col": "Mô tả",
    "admin_categories.status_col": "Trạng thái",
    "admin_categories.action_col": "Thao tác",
    "admin_categories.active": "Đang sử dụng",
    "admin_categories.hidden": "Đã ẩn",
    "admin_categories.create_modal_title": "Thêm mới Danh mục Sự cố",
    "admin_categories.edit_modal_title": "Chỉnh sửa Danh mục",
    "admin_categories.modal_desc":
      "Thiết lập các loại sự cố môi trường để phân loại dễ dàng.",
    "admin_categories.default_severity": "Mức độ mặc định",

    // Officer Management
    "admin_officers.assigned_reports": "Báo cáo được giao",
    "admin_officers.resolution_rate": "Tỷ lệ giải quyết",
    "admin_officers.view_details": "Xem chi tiết",
    "admin_officers.activate": "Kích hoạt",
    "admin_officers.deactivate": "Vô hiệu hóa",

    // Reports Management
    "reports.management_title": "Quản lý Báo cáo",
    "reports.management_subtitle":
      "Xem, tìm kiếm và quản lý tất cả báo cáo môi trường.",
    "reports.env_reports": "Báo cáo Môi trường",
    "reports.search_placeholder": "Tìm kiếm báo cáo...",
    "reports.col_title": "Tiêu đề",
    "reports.col_category": "Danh mục",
    "reports.col_severity": "Mức độ",
    "reports.col_status": "Trạng thái",
    "reports.col_date": "Ngày tạo",
    "reports.col_actions": "Thao tác",
    "reports.prev": "Trang trước",
    "reports.next": "Trang sau",

    // System Monitoring
    "monitoring.title": "Giám sát Hệ thống",
    "monitoring.auto_refresh": "Tự động làm mới mỗi 30s",
    "monitoring.uptime": "Thời gian hoạt động",
    "monitoring.memory": "Bộ nhớ",
    "monitoring.healthy": "Hoạt động tốt",

    // Analytics
    "analytics.title": "Bảng Thống kê & Phân tích",
    "analytics.last_6_months": "6 tháng qua",
    "analytics.last_year": "Năm qua",
    "analytics.all_time": "Tất cả thời gian",
    "analytics.reports_over_time": "Báo cáo theo Thời gian",
    "analytics.reports_by_category": "Báo cáo theo Danh mục",
    "analytics.severity_distribution": "Phân bổ theo Mức độ",
    "analytics.resolution_rate_trend": "Xu hướng Tỷ lệ Giải quyết",

    // Audit Logs
    "audit.title": "Nhật ký Hoạt động (Audit Logs)",
    "audit.search_placeholder": "Tìm kiếm nhật ký...",
    "audit.col_timestamp": "Thời gian",
    "audit.col_user": "Người dùng",
    "audit.col_action": "Hành động",
    "audit.col_resource": "Tài nguyên",
    "audit.col_details": "Chi tiết",

    // Settings
    "settings.title": "Cấu hình Hệ thống",
    "settings.general_title": "Cấu hình Chung",
    "settings.general_desc": "Thông tin cơ bản về nền tảng EcoAlert.",
    "settings.system_name": "Tên hệ thống",
    "settings.system_desc": "Mô tả hệ thống",
    "settings.notifications_title": "Thông báo",
    "settings.notifications_desc":
      "Thiết lập quy tắc gửi thông báo toàn hệ thống.",
    "settings.email_notif": "Email Thông báo",
    "settings.email_notif_desc":
      "Gửi báo cáo tổng hợp hàng ngày tới Quản trị viên",
    "settings.push_notif": "Thông báo đẩy (Push)",
    "settings.push_notif_desc": "Bật thông báo đẩy thời gian thực",
    "settings.security_title": "Bảo mật & Bảo trì",
    "settings.security_desc": "Chính sách bảo mật và chế độ bảo trì.",
    "settings.session_timeout": "Thời gian hết hạn phiên làm việc (phút)",
    "settings.maintenance_mode": "Chế độ Bảo trì",
    "settings.maintenance_desc":
      "Tạm thời khóa truy cập hệ thống đối với Citizen & Officer",

    "notifications.title": "Thông báo",
    "notifications.unread_messages": "Bạn có tin nhắn chưa đọc",
    "notifications.mark_all_read": "Đánh dấu tất cả đã đọc",
    "notifications.empty_title": "Chưa có thông báo nào",
    "notifications.empty_desc": "Tất cả thông báo mới sẽ xuất hiện tại đây.",
    "notifications.mark_read": "Đánh dấu đã đọc",

    // Interactive Map & Edit Report Modal
    "map.title": "Bản đồ Tương tác",
    "map.subtitle":
      "Góc nhìn địa lý của tất cả các sự cố môi trường được báo cáo.",
    "map.search_location": "Tìm vị trí...",
    "map.filter_severity": "Lọc theo Mức độ",
    "map.all_incidents": "Tất cả Sự cố",
    "map.critical": "Nghiêm trọng",
    "map.high": "Cao",
    "map.normal": "Bình thường",
    "map.layers": "Lớp bản đồ",
    "map.medium": "Trung bình",
    "map.low": "Thấp",
    "map.visualization_mode": "Chế độ hiển thị bản đồ",
    "map.marker_view": "Sự cố",
    "map.category": "Danh mục",
    "map.all_categories": "Tất cả danh mục",
    "map.status": "Trạng thái",
    "map.all_statuses": "Tất cả trạng thái",
    "map.active_incidents": "Sự cố đang hoạt động",
    "map.closed": "Đã đóng",
    "map.environmental_hotspots": "Điểm nóng môi trường",
    "map.incidents_in_view": "Sự cố đang hiển thị",
    "map.showing": "Đang hiển thị",
    "map.incidents": "sự cố",
    "map.no_matches": "Không có sự cố phù hợp với bộ lọc hiện tại.",
    "map.severity_legend": "Mức độ nghiêm trọng",
    "map.hotspot_intensity": "Cường độ điểm nóng môi trường",
    "map.intensity_low": "Thấp",
    "map.intensity_moderate": "Vừa",
    "map.intensity_high": "Cao",
    "map.intensity_very_high": "Rất cao",
    "map.hotspot_combines": "Cường độ kết hợp mật độ sự cố và mức độ nghiêm trọng.",

    "officer.navigation": "Điều hướng cán bộ",
    "edit_report.modal_title": "Chỉnh sửa Báo cáo Sự cố",
    "edit_report.title_label": "Tiêu đề báo cáo",
    "edit_report.address_label": "Địa chỉ / Vị trí",
    "edit_report.desc_label": "Mô tả chi tiết",
    "edit_report.evidence_label": "Hình ảnh minh chứng",
    "edit_report.add_image": "Thêm ảnh",

    // Alert Detail
    "alert_detail.details_title": "Chi tiết Báo cáo",
    "alert_detail.description": "Mô tả",
    "alert_detail.reported_on": "Ngày báo cáo",
    "alert_detail.address": "Địa chỉ",
    "alert_detail.evidence": "Bằng chứng & Hình ảnh",
    "alert_detail.no_media": "Không có hình ảnh đính kèm.",
    "alert_detail.ai_analysis": "Phân tích AI",
    "alert_detail.detected_category": "Danh mục phát hiện",
    "alert_detail.confidence": "Độ tin cậy",
    "alert_detail.ai_read_only": "Diễn giải AI và nhận diện vật thể từ hình ảnh, hiển thị ở chế độ chỉ đọc.",
    "alert_detail.ai_confidence_aria": "Độ tin cậy AI",
    "alert_detail.confidence_semantic": "Ngữ nghĩa",
    "alert_detail.confidence_category": "Danh mục",
    "alert_detail.confidence_unavailable": "Không khả dụng",
    "alert_detail.suggested_severity": "Mức độ gợi ý",
    "alert_detail.ai_disclaimer": "Phân tích AI hỗ trợ phân loại và được Cán bộ kiểm tra trước khi đưa ra quyết định cuối cùng.",
    "alert_detail.officer_actions": "Hành động Cán bộ",
    "alert_detail.btn_verify": "Xác minh & Chấp nhận",
    "alert_detail.btn_in_progress": "Đang xử lý",
    "alert_detail.btn_resolve": "Đánh dấu Đã xử lý",
    "alert_detail.btn_reject": "Từ chối Báo cáo",

    // Common Buttons & Labels
    "btn.create_user": "Tạo người dùng mới",
    "btn.add_officer": "Thêm mới Cán bộ",
    "btn.add_category": "Thêm danh mục mới",
    "btn.save_changes": "Lưu thay đổi",
    "btn.cancel": "Hủy",
    "btn.delete": "Xóa",
    "btn.edit": "Chỉnh sửa",
    "btn.search": "Tìm kiếm...",
    "btn.view": "Xem",
    "btn.filter": "Lọc",
    "btn.back": "Quay lại",
    "btn.next": "Tiếp tục",
    "btn.submit": "Gửi báo cáo",

    // Toast Messages
    "toast.new_alert_created": "Sự cố mới vừa được báo cáo:",
    "toast.alert_updated": "Trạng thái sự cố đã được cập nhật!",
    "toast.alert_deleted": "Sự cố đã bị xóa!",
    "toast.ai_analyzed": "AI đã phân tích sự cố! Mức độ:",
    "toast.officer_assigned_success": "Đã phân công cán bộ thành công.",
    "toast.handling_started_success": "Đã bắt đầu xử lý sự cố.",
    "toast.arrival_confirmed_success": "Đã xác nhận đến hiện trường.",
    "toast.incident_resolved_success": "Sự cố đã được xử lý hoàn tất.",
    "toast.incident_closed_success": "Sự cố đã được đóng.",
    "toast.report_accepted_success": "Đã chấp nhận báo cáo thành công.",
    "toast.report_rejected_success": "Đã từ chối báo cáo thành công.",
    "toast.login_success": "Đăng nhập thành công",
    "toast.register_success": "Đăng ký thành công! Vui lòng đăng nhập.",
    "toast.register_failed": "Đăng ký thất bại",
    "toast.profile_updated": "Cập nhật hồ sơ thành công!",
    "toast.profile_update_failed": "Cập nhật hồ sơ thất bại",
    "toast.password_mismatch": "Mật khẩu mới không khớp!",
    "toast.password_min_length": "Mật khẩu mới phải từ 6 ký tự trở lên!",
    "toast.change_password_success": "Đổi mật khẩu thành công!",
    "toast.change_password_failed": "Đổi mật khẩu thất bại",
    "toast.delete_pending_only": "Chỉ có thể xóa báo cáo khi đang ở trạng thái chờ duyệt!",
    "toast.report_deleted_success": "Đã xóa báo cáo thành công!",
    "toast.report_delete_failed": "Xóa báo cáo thất bại.",
    "toast.uploading_image": "Đang tải ảnh lên...",
    "toast.upload_image_success": "Đã tải ảnh lên thành công!",
    "toast.upload_image_failed": "Tải ảnh thất bại",
    "toast.title_min_length": "Tiêu đề phải có ít nhất 5 ký tự",
    "toast.desc_min_length": "Mô tả phải có ít nhất 10 ký tự",
    "toast.report_updated_success": "Đã cập nhật báo cáo!",
    "toast.report_update_failed": "Cập nhật báo cáo thất bại",
    "toast.invalid_address_location": "Địa chỉ này không chứa vị trí hợp lệ. Vui lòng chọn kết quả khác.",
    "toast.browser_no_location": "Trình duyệt của bạn không hỗ trợ dịch vụ vị trí.",
    "toast.locating_current": "Đang tìm vị trí hiện tại của bạn…",
    "toast.current_location_selected": "Đã chọn vị trí hiện tại.",
    "toast.cannot_confirm_location": "Không thể xác nhận vị trí hiện tại. Vui lòng thử lại.",
    "toast.location_access_unavailable": "Không thể truy cập vị trí. Kiểm tra quyền trình duyệt và thử lại.",
    "toast.select_image_format": "Vui lòng chọn hình ảnh định dạng JPG, PNG hoặc WEBP.",
    "toast.image_max_size": "Hình ảnh minh chứng phải từ 10MB trở xuống.",
    "toast.select_location_required": "Vui lòng chọn và xác nhận vị trí sự cố trước khi tiếp tục.",
    "toast.add_evidence_required": "Vui lòng thêm ít nhất một ảnh minh chứng trước khi tiếp tục.",
    "toast.uploading_evidence": "Đang tải ảnh minh chứng lên…",
    "toast.report_submit_success": "Đã gửi báo cáo thành công.",
    "toast.report_submit_error": "Không thể gửi báo cáo. Vui lòng thử lại.",
    "toast.fill_required_fields": "Vui lòng điền đầy đủ các thông tin bắt buộc",
    "toast.create_account_success": "Đã tạo tài khoản thành công",
    "toast.create_account_failed": "Lỗi khi khởi tạo người dùng",
    "toast.category_updated": "Cập nhật danh mục thành công",
    "toast.category_created": "Tạo danh mục mới thành công",
    "toast.category_status_updated": "Cập nhật trạng thái danh mục thành công",
    "toast.category_status_failed": "Lỗi khi đổi trạng thái danh mục",
    "toast.category_deleted": "Đã xóa danh mục thành công",
    "toast.category_delete_failed": "Xóa danh mục thất bại",
    "toast.status_updated": "Đã cập nhật trạng thái",
    "toast.role_updated_admin": "Đã cập nhật vai trò: Quản trị viên (Admin)",
    "toast.role_updated_officer": "Đã cập nhật vai trò: Cán bộ (Officer)",
    "toast.role_updated_citizen": "Đã cập nhật vai trò: Người dân (Citizen)",
    "toast.role_update_failed": "Có lỗi xảy ra khi đổi vai trò",
    "toast.account_status_updated": "Đã cập nhật trạng thái tài khoản",
    "toast.user_deleted_success": "Đã xóa người dùng thành công",
    "toast.settings_saved": "Đã lưu cấu hình hệ thống",
    "toast.location_unavailable": "Không thể lấy thông tin vị trí.",
    "toast.cannot_open_maps": "Không thể mở Google Maps. Vui lòng thử lại.",
    "toast.coordinates_copied": "Đã sao chép tọa độ.",
  },
  en: {
    // Topbar & Nav
    "nav.dashboard": "Dashboard",
    "nav.users": "User Management",
    "nav.officers": "Officer Management",
    "nav.reports": "Report Management",
    "nav.gis": "GIS Map",
    "nav.monitoring": "System Monitoring",
    "nav.analytics": "Analytics",
    "nav.audit": "Audit Logs",
    "nav.settings": "System Settings",
    "nav.home": "Home",
    "nav.report_incident": "Report Incident",
    "nav.my_reports": "My Reports",
    "nav.profile": "Profile",
    "nav.logout": "Log out",
    "nav.signin": "Sign In",
    "nav.portal": "EcoAlert Admin Portal",

    // Hero Section
    "hero.protecting": "Protecting",
    "hero.our_environment": " Our Environment",
    "hero.subtitle":
      "Report environmental incidents instantly. AI-powered classification. Real-time GIS tracking.",
    "hero.btn_report": "Report an Incident",
    "hero.btn_explore": "Explore Nearby",

    // Citizen Footer
    "footer.about_title": "About EcoAlert",
    "footer.about_desc":
      "Smart environmental incident reporting & management system powered by real-time AI & GIS technology.",
    "footer.quick_links": "Quick Links",
    "footer.contact": "Support & Contact",
    "footer.address": "Ho Chi Minh City, Vietnam",
    "footer.phone": "Hotline: 1900 xxxx",
    "footer.rights": "All rights reserved.",

    // Statuses & Priority
    "status.all": "All",
    "status.pending": "Pending Verification",
    "status.in_progress": "In Progress",
    "status.resolved": "Resolved",
    "status.rejected": "Rejected",
    "priority.low": "Low",
    "priority.medium": "Medium",
    "priority.high": "High",
    "priority.urgent": "Urgent",

    // Create Report Wizard
    "report_create.title": "Report an Environmental Incident",
    "report_create.subtitle":
      "Provide detailed information to help authorities take timely action",
    "report_create.step1": "Information",
    "report_create.step2": "Location",
    "report_create.step3": "Media & Evidence",
    "report_create.step4": "Review & Confirm",
    "report_create.field_title": "Report Title",
    "report_create.field_title_placeholder":
      "E.g., Illegal waste dumping near street...",
    "report_create.field_category": "Incident Category",
    "report_create.field_description": "Detailed Description",
    "report_create.field_description_placeholder":
      "Describe the incident status, scale, and impact in detail...",
    "report_create.field_address": "Incident Address",
    "report_create.field_address_placeholder":
      "Enter address or pick location on map...",
    "report_create.map_instruction":
      "Click on the map to select exact incident coordinates",
    "report_create.dropzone_text": "Drag & drop images here or click to upload",
    "report_create.dropzone_subtext": "Supports JPG, PNG, WEBP (Max 10MB)",
    "report_create.ai_classification": "AI Automated Classification",
    "report_create.submit_confirm": "Confirm & Submit Report",
    "report_create.submitting": "Submitting report...",

    // My Reports Page
    "my_reports.title": "My Reports",
    "my_reports.subtitle":
      "Track the progress of your submitted environmental reports",
    "my_reports.empty": "No reports submitted yet",
    "my_reports.empty_desc":
      "Help protect the environment by submitting your first report.",
    "my_reports.btn_create": "Create New Report",
    "my_reports.delete_confirm_title": "Confirm Report Deletion",
    "my_reports.delete_confirm_desc":
      "Are you sure you want to delete this report? This action cannot be undone.",

    // Alert Detail Page
    "alert_detail.title": "Incident Report Details",
    "alert_detail.timeline": "Resolution Timeline",
    "alert_detail.location": "Geographic Location",
    "alert_detail.comments": "Comments & Responses",
    "alert_detail.add_comment": "Write a comment...",
    "alert_detail.submit_comment": "Submit Comment",

    // Officer Topbar & Titles
    "officer.dashboard": "Officer Dashboard",
    "officer.subtitle": "Monitor and manage environmental reports.",
    "officer.assigned": "Assigned Reports",
    "officer.pending": "Pending Verification",
    "officer.map": "Monitoring Map",
    "officer.notifications": "Officer Notifications",
    "officer.stats": "Statistics",
    "officer.details": "Officer Report Details",

    // Officer Assigned & Pending Reports
    "officer_reports.search_placeholder":
      "Search by title, address, reporter...",
    "officer_reports.table_id": "Incident ID",
    "officer_reports.table_title": "Title & Category",
    "officer_reports.table_location": "Location",
    "officer_reports.table_priority": "Priority",
    "officer_reports.table_status": "Status",
    "officer_reports.table_date": "Report Date",
    "officer_reports.table_action": "Action",
    "officer_reports.btn_approve": "Approve & Accept",
    "officer_reports.btn_reject": "Reject Report",
    "officer_reports.reject_title": "Reject Incident Report",
    "officer_reports.reject_reason_label": "Rejection Reason",
    "officer_reports.reject_reason_placeholder":
      "Provide detailed reason to notify the reporter...",
    "officer_reports.update_status_title": "Update Resolution Status",
    "officer_reports.upload_evidence": "Upload Evidence Photos",
    "officer_reports.officer_notes": "Officer Notes",

    // Admin Dashboard & Pages
    "admin_users.title": "User Management",
    "admin_users.subtitle": "Manage citizen accounts and access permissions",
    "admin_users.col_name": "Full Name",
    "admin_users.col_email": "Email",
    "admin_users.col_role": "Role",
    "admin_users.col_status": "Status",
    "admin_users.col_created": "Created Date",
    "admin_users.create_title": "Create New User",
    "admin_users.role_citizen": "Citizen",
    "admin_users.role_officer": "Officer",
    "admin_users.role_admin": "Admin",

    "admin_officers.title": "Environmental Officer Management",
    "admin_officers.subtitle": "Manage officer assignments and district duties",
    "admin_officers.district": "Assigned District",
    "admin_officers.active_tasks": "Active Tasks",

    "admin_categories.title": "Incident Categories Management",
    "admin_categories.subtitle":
      "Configure environmental incident types and icons",
    "admin_categories.col_name": "Category Name",
    "admin_categories.col_priority": "Default Priority",

    "admin_monitoring.title": "Infrastructure System Monitoring",
    "admin_monitoring.subtitle":
      "Track server metrics, database health, and API latency",
    "admin_monitoring.cpu": "CPU Load",
    "admin_monitoring.ram": "RAM Usage",
    "admin_monitoring.db_status": "Database Connection",
    "admin_monitoring.latency": "API Latency",
    "admin_monitoring.uptime": "System Uptime",

    "admin_analytics.title": "Analytics & Advanced Insights",
    "admin_analytics.subtitle":
      "Environmental incident trends and historical metrics",
    "admin_analytics.export_pdf": "Export PDF Report",
    "admin_analytics.export_excel": "Export Excel Report",

    "admin_audit.title": "System Audit Logs",
    "admin_audit.subtitle": "Track user and administrator action logs",
    "admin_audit.col_timestamp": "Timestamp",
    "admin_audit.col_actor": "Actor",
    "admin_audit.col_action": "Action",
    "admin_audit.col_ip": "IP Address",
    "admin_audit.col_details": "Details",

    "admin_settings.title": "System Configuration",
    "admin_settings.subtitle":
      "Customize email settings, AI service, and cloud storage",
    "admin_settings.smtp_title": "Email Configuration (SMTP)",
    "admin_settings.ai_title": "AI Classification Service",
    "admin_settings.storage_title": "S3 / Cloudinary Storage",

    // Category Management
    "admin_categories.code_col": "Code",
    "admin_categories.desc_col": "Description",
    "admin_categories.status_col": "Status",
    "admin_categories.action_col": "Actions",
    "admin_categories.active": "Active",
    "admin_categories.hidden": "Hidden",
    "admin_categories.create_modal_title": "Add New Category",
    "admin_categories.edit_modal_title": "Edit Category",
    "admin_categories.modal_desc":
      "Configure environmental incident categories for classification.",
    "admin_categories.default_severity": "Default Severity",

    // Officer Management
    "admin_officers.assigned_reports": "Assigned Reports",
    "admin_officers.resolution_rate": "Resolution Rate",
    "admin_officers.view_details": "View Details",
    "admin_officers.activate": "Activate",
    "admin_officers.deactivate": "Deactivate",

    // Reports Management
    "reports.management_title": "Report Management",
    "reports.management_subtitle":
      "View, search, and manage all environmental reports.",
    "reports.env_reports": "Environmental Reports",
    "reports.search_placeholder": "Search reports...",
    "reports.col_title": "Title",
    "reports.col_category": "Category",
    "reports.col_severity": "Severity",
    "reports.col_status": "Status",
    "reports.col_date": "Date",
    "reports.col_actions": "Actions",
    "reports.prev": "Previous",
    "reports.next": "Next",

    // System Monitoring
    "monitoring.title": "System Monitoring",
    "monitoring.auto_refresh": "Auto-refreshing every 30s",
    "monitoring.uptime": "Uptime",
    "monitoring.memory": "Memory",
    "monitoring.healthy": "Healthy",

    // Analytics
    "analytics.title": "Analytics Dashboard",
    "analytics.last_6_months": "Last 6 Months",
    "analytics.last_year": "Last Year",
    "analytics.all_time": "All Time",
    "analytics.reports_over_time": "Reports Over Time",
    "analytics.reports_by_category": "Reports by Category",
    "analytics.severity_distribution": "Severity Distribution",
    "analytics.resolution_rate_trend": "Resolution Rate Trend",

    // Audit Logs
    "audit.title": "System Activity Logs",
    "audit.search_placeholder": "Search logs...",
    "audit.col_timestamp": "Timestamp",
    "audit.col_user": "User",
    "audit.col_action": "Action",
    "audit.col_resource": "Resource",
    "audit.col_details": "Details",

    // Settings
    "settings.title": "System Configuration",
    "settings.general_title": "General Configuration",
    "settings.general_desc": "Basic platform information.",
    "settings.system_name": "System Name",
    "settings.system_desc": "System Description",
    "settings.notifications_title": "Notifications",
    "settings.notifications_desc": "Configure global notification rules.",
    "settings.email_notif": "Email Notifications",
    "settings.email_notif_desc": "Send daily digest reports to Administrators",
    "settings.push_notif": "Push Notifications",
    "settings.push_notif_desc": "Enable real-time push notifications",
    "settings.security_title": "Security & Maintenance",
    "settings.security_desc":
      "Security policies and maintenance mode settings.",
    "settings.session_timeout": "Session Timeout (minutes)",
    "settings.maintenance_mode": "Maintenance Mode",
    "settings.maintenance_desc":
      "Temporarily restrict access for Citizens & Officers",

    "notifications.title": "Notifications",
    "notifications.unread_messages": "You have unread messages",
    "notifications.mark_all_read": "Mark all as read",
    "notifications.empty_title": "No notifications yet",
    "notifications.empty_desc": "New alerts assigned to you will appear here.",
    "notifications.mark_read": "Mark read",

    // Interactive Map & Edit Report Modal
    "map.title": "Interactive Map",
    "map.subtitle": "Geospatial view of all reported environmental incidents.",
    "map.search_location": "Search locations...",
    "map.filter_severity": "Filter by Severity",
    "map.all_incidents": "All Incidents",
    "map.critical": "Critical",
    "map.high": "High",
    "map.normal": "Normal",
    "map.layers": "Map Layers",
    "map.medium": "Medium",
    "map.low": "Low",
    "map.visualization_mode": "Map visualization mode",
    "map.marker_view": "Incidents",
    "map.category": "Category",
    "map.all_categories": "All categories",
    "map.status": "Status",
    "map.all_statuses": "All statuses",
    "map.active_incidents": "Active incidents",
    "map.closed": "Closed",
    "map.environmental_hotspots": "Environmental Hotspots",
    "map.incidents_in_view": "Incidents in view",
    "map.showing": "Showing",
    "map.incidents": "incidents",
    "map.no_matches": "No incidents match the current filters.",
    "map.severity_legend": "Incident severity",
    "map.hotspot_intensity": "Environmental Hotspot Intensity",
    "map.intensity_low": "Low",
    "map.intensity_moderate": "Moderate",
    "map.intensity_high": "High",
    "map.intensity_very_high": "Very high",
    "map.hotspot_combines": "Intensity combines incident density and severity.",

    "officer.navigation": "Officer navigation",
    "edit_report.modal_title": "Edit Incident Report",
    "edit_report.title_label": "Report Title",
    "edit_report.address_label": "Address / Location",
    "edit_report.desc_label": "Detailed Description",
    "edit_report.evidence_label": "Evidence Photos",
    "edit_report.add_image": "Add Photo",

    // Alert Detail
    "alert_detail.details_title": "Report Details",
    "alert_detail.description": "Description",
    "alert_detail.reported_on": "Reported On",
    "alert_detail.address": "Address",
    "alert_detail.evidence": "Evidence & Media",
    "alert_detail.no_media": "No media attached to this report.",
    "alert_detail.ai_analysis": "AI Analysis",
    "alert_detail.detected_category": "Detected Category",
    "alert_detail.confidence": "Confidence Score",
    "alert_detail.ai_read_only": "AI interpretation and image-object detection, displayed in read-only mode.",
    "alert_detail.ai_confidence_aria": "AI confidence",
    "alert_detail.confidence_semantic": "Semantic",
    "alert_detail.confidence_category": "Category",
    "alert_detail.confidence_unavailable": "Not available",
    "alert_detail.suggested_severity": "Suggested severity",
    "alert_detail.ai_disclaimer": "AI analysis supports classification and is reviewed by an Officer before a final decision is made.",
    "alert_detail.officer_actions": "Officer Actions",
    "alert_detail.btn_verify": "Verify & Accept Report",
    "alert_detail.btn_in_progress": "Mark In Progress",
    "alert_detail.btn_resolve": "Mark Resolved",
    "alert_detail.btn_reject": "Reject Report",

    // Dashboard Overview Stats
    "stats.total_users": "Total Users",
    "stats.total_reports": "Total Reports",
    "stats.active_officers": "Active Officers",
    "stats.system_status": "System Status",
    "stats.operational": "Operational 100%",
    "stats.assigned_to_me": "Assigned to Me",
    "stats.pending_verification": "Pending Verification",
    "stats.in_progress": "In Progress",
    "stats.resolved": "Resolved",
    "stats.reports_by_status": "Reports by Status (Live Data)",
    "stats.user_demographics": "User Demographics (Live Data)",
    "stats.category_distribution": "Category Distribution (Live Data)",
    "stats.recent_activity": "Recent Activity",
    "stats.latest_reports_desc": "Latest reports across all statuses.",
    "stats.no_recent_reports": "No recent reports found",
    "stats.quick_links": "Quick Links",
    "stats.environmental_overview": "Environmental Overview",
    "stats.community_snapshot":
      "A real-time snapshot of environmental incident reporting across the community.",

    // Citizen Home & Maps
    "citizen.live_map": "Live Incident Map",
    "citizen.map_desc": "Real-time environmental incidents across your area",
    "citizen.filter_category": "Filter by Category",
    "citizen.category_desc": "Click a category to filter incidents on the map",
    "citizen.nearby_incidents": "Nearby Incidents",
    "citizen.nearby_desc": "Recent environmental reports in your area",
    "citizen.view_details": "View details",

    // Auth & Profile
    "auth.login_title": "EcoAlert Sign In",
    "auth.login_subtitle": "Enter your account credentials to continue",
    "auth.register_title": "Register New Account",
    "auth.register_subtitle":
      "Join the community in protecting our environment",
    "auth.email": "Email Address",
    "auth.password": "Password",
    "auth.confirm_password": "Confirm Password",
    "auth.full_name": "Full Name",
    "auth.phone": "Phone Number",
    "auth.remember_me": "Remember me",
    "auth.forgot_password": "Forgot password?",
    "auth.no_account": "Don't have an account? Sign up",
    "auth.has_account": "Already have an account? Sign in",
    "profile.title": "User Profile",
    "profile.change_password": "Change Password",
    "profile.old_password": "Current Password",
    "profile.new_password": "New Password",

    // Common Buttons & Labels
    "btn.create_user": "Create New User",
    "btn.add_officer": "Add New Officer",
    "btn.add_category": "Add New Category",
    "btn.save_changes": "Save Changes",
    "btn.cancel": "Cancel",
    "btn.delete": "Delete",
    "btn.edit": "Edit",
    "btn.search": "Search...",
    "btn.view": "View",
    "btn.filter": "Filter",
    "btn.back": "Back",
    "btn.next": "Next",
    "btn.submit": "Submit Report",

    // Toast Messages
    "toast.new_alert_created": "New incident reported:",
    "toast.alert_updated": "Incident status updated!",
    "toast.alert_deleted": "Incident deleted!",
    "toast.ai_analyzed": "AI analyzed incident! Priority:",
    "toast.officer_assigned_success": "Officer assigned successfully.",
    "toast.handling_started_success": "Incident handling started.",
    "toast.arrival_confirmed_success": "Arrival confirmed.",
    "toast.incident_resolved_success": "Incident marked as resolved.",
    "toast.incident_closed_success": "Incident closed.",
    "toast.report_accepted_success": "Report accepted successfully.",
    "toast.report_rejected_success": "Report rejected successfully.",
    "toast.login_success": "Successfully logged in",
    "toast.register_success": "Registration successful! Please log in.",
    "toast.register_failed": "Registration failed",
    "toast.profile_updated": "Profile updated successfully!",
    "toast.profile_update_failed": "Profile update failed",
    "toast.password_mismatch": "New passwords do not match!",
    "toast.password_min_length": "New password must be at least 6 characters!",
    "toast.change_password_success": "Password changed successfully!",
    "toast.change_password_failed": "Password change failed",
    "toast.delete_pending_only": "Reports can only be deleted when pending verification!",
    "toast.report_deleted_success": "Report deleted successfully!",
    "toast.report_delete_failed": "Failed to delete report.",
    "toast.uploading_image": "Uploading image...",
    "toast.upload_image_success": "Image uploaded successfully!",
    "toast.upload_image_failed": "Failed to upload image",
    "toast.title_min_length": "Title must be at least 5 characters",
    "toast.desc_min_length": "Description must be at least 10 characters",
    "toast.report_updated_success": "Report updated!",
    "toast.report_update_failed": "Failed to update report",
    "toast.invalid_address_location": "This address does not include a valid location. Please choose another result.",
    "toast.browser_no_location": "Your browser does not support location services.",
    "toast.locating_current": "Finding your current location…",
    "toast.current_location_selected": "Current location selected.",
    "toast.cannot_confirm_location": "We could not confirm your current location. Please try again.",
    "toast.location_access_unavailable": "Location access was unavailable. Check your browser permission and try again.",
    "toast.select_image_format": "Please select a JPG, PNG, or WEBP image.",
    "toast.image_max_size": "The evidence image must be 10 MB or smaller.",
    "toast.select_location_required": "Select and confirm the incident location before continuing.",
    "toast.add_evidence_required": "Please add one image as evidence before continuing.",
    "toast.uploading_evidence": "Uploading evidence…",
    "toast.report_submit_success": "Report submitted successfully.",
    "toast.report_submit_error": "Unable to submit the report. Please try again.",
    "toast.fill_required_fields": "Please fill in all required fields",
    "toast.create_account_success": "Account created successfully",
    "toast.create_account_failed": "Error creating account",
    "toast.category_updated": "Category updated successfully",
    "toast.category_created": "New category created successfully",
    "toast.category_status_updated": "Category status updated",
    "toast.category_status_failed": "Error changing category status",
    "toast.category_deleted": "Category deleted successfully",
    "toast.category_delete_failed": "Failed to delete category",
    "toast.status_updated": "Status updated",
    "toast.role_updated_admin": "Role updated: Administrator",
    "toast.role_updated_officer": "Role updated: Environmental Officer",
    "toast.role_updated_citizen": "Role updated: Citizen",
    "toast.role_update_failed": "Failed to update role",
    "toast.account_status_updated": "Account status updated",
    "toast.user_deleted_success": "User deleted successfully",
    "toast.settings_saved": "Saved system settings",
    "toast.location_unavailable": "Location is unavailable.",
    "toast.cannot_open_maps": "Unable to open Google Maps. Please try again.",
    "toast.coordinates_copied": "Coordinates copied.",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("ecoalert_lang");
    return saved === "en" || saved === "vi" ? saved : "vi";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("ecoalert_lang", lang);
  };

  const toggleLanguage = () => {
    const newLang = language === "vi" ? "en" : "vi";
    setLanguage(newLang);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations["vi"]?.[key] || translations["en"]?.[key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, toggleLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
