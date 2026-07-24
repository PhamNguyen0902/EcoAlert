import React, { createContext, useContext, useState } from 'react';

export type Language = 'vi' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Topbar & Nav
    'nav.dashboard': 'Tổng quan',
    'nav.users': 'Quản lý Người dùng',
    'nav.officers': 'Quản lý Cán bộ',
    'nav.reports': 'Quản lý Báo cáo',
    'nav.categories': 'Danh mục Sự cố',
    'nav.monitoring': 'Giám sát Hệ thống',
    'nav.analytics': 'Thống kê Nâng cao',
    'nav.audit': 'Nhật ký Hoạt động',
    'nav.settings': 'Cấu hình Hệ thống',
    'nav.home': 'Trang chủ',
    'nav.report_incident': 'Gửi báo cáo',
    'nav.my_reports': 'Báo cáo của tôi',
    'nav.profile': 'Hồ sơ cá nhân',
    'nav.logout': 'Đăng xuất',
    'nav.signin': 'Đăng nhập',
    'nav.portal': 'Cổng Quản trị EcoAlert',

    // Hero Section
    'hero.protecting': 'Bảo vệ',
    'hero.our_environment': ' Môi trường của Chúng ta',
    'hero.subtitle': 'Báo cáo sự cố môi trường ngay lập tức. Phân loại bằng AI. Theo dõi GIS thời gian thực.',
    'hero.btn_report': 'Báo cáo Sự cố Môi trường',
    'hero.btn_explore': 'Khám phá Sự cố Xung quanh',

    // Officer Topbar & Titles
    'officer.dashboard': 'Tổng quan Cán bộ',
    'officer.subtitle': 'Theo dõi và xử lý các báo cáo sự cố môi trường',
    'officer.assigned': 'Báo cáo được giao',
    'officer.pending': 'Chờ xác minh',
    'officer.map': 'Bản đồ giám sát GIS',
    'officer.notifications': 'Thông báo',
    'officer.stats': 'Thống kê hiệu suất',
    'officer.details': 'Chi tiết Báo cáo',

    // Dashboard Overview Stats
    'stats.total_users': 'Tổng Người dùng',
    'stats.total_reports': 'Tổng Báo cáo',
    'stats.active_officers': 'Cán bộ Đang hoạt động',
    'stats.system_status': 'Trạng thái Hệ thống',
    'stats.operational': 'Hoạt động 100%',
    'stats.assigned_to_me': 'Được giao cho tôi',
    'stats.pending_verification': 'Chờ xác minh',
    'stats.in_progress': 'Đang xử lý',
    'stats.resolved': 'Đã hoàn thành',
    'stats.reports_by_status': 'Báo cáo theo Trạng thái (Thực tế)',
    'stats.user_demographics': 'Cơ cấu Người dùng (Thực tế)',
    'stats.category_distribution': 'Phân bổ theo Danh mục (Thực tế)',
    'stats.recent_activity': 'Hoạt động Gần đây',
    'stats.latest_reports_desc': 'Các báo cáo mới nhất trên toàn hệ thống',
    'stats.no_recent_reports': 'Chưa có báo cáo nào gần đây',
    'stats.quick_links': 'Liên kết Nhanh',
    'stats.environmental_overview': 'Tổng quan Môi trường',
    'stats.community_snapshot': 'Bức tranh thời gian thực về tình hình phản ánh sự cố môi trường từ cộng đồng.',

    // Citizen Home & Maps
    'citizen.live_map': 'Bản đồ Sự cố Thời gian thực',
    'citizen.map_desc': 'Các phản ánh vi phạm môi trường theo khu vực địa lý của bạn',
    'citizen.filter_category': 'Lọc theo Loại sự cố',
    'citizen.category_desc': 'Nhấp vào loại sự cố để lọc vị trí tương ứng trên bản đồ',
    'citizen.nearby_incidents': 'Sự cố Xung quanh bạn',
    'citizen.nearby_desc': 'Các báo cáo sự cố môi trường mới nhất ở khu vực lân cận',
    'citizen.view_details': 'Xem chi tiết',

    // Common Buttons & Labels
    'btn.create_user': 'Tạo người dùng mới',
    'btn.add_officer': 'Thêm mới Cán bộ',
    'btn.add_category': 'Thêm danh mục mới',
    'btn.save_changes': 'Lưu thay đổi',
    'btn.cancel': 'Hủy',
    'btn.delete': 'Xóa',
    'btn.edit': 'Chỉnh sửa',
    'btn.search': 'Tìm kiếm...',
    'btn.view': 'Xem',
    'btn.filter': 'Lọc',
    'btn.back': 'Quay lại',
    'btn.next': 'Tiếp tục',
    'btn.submit': 'Gửi báo cáo',
  },
  en: {
    // Topbar & Nav
    'nav.dashboard': 'Dashboard',
    'nav.users': 'User Management',
    'nav.officers': 'Officer Management',
    'nav.reports': 'Report Management',
    'nav.categories': 'Incident Categories',
    'nav.monitoring': 'System Monitoring',
    'nav.analytics': 'Analytics',
    'nav.audit': 'Audit Logs',
    'nav.settings': 'System Settings',
    'nav.home': 'Home',
    'nav.report_incident': 'Report Incident',
    'nav.my_reports': 'My Reports',
    'nav.profile': 'Profile',
    'nav.logout': 'Log out',
    'nav.signin': 'Sign In',
    'nav.portal': 'EcoAlert Admin Portal',

    // Hero Section
    'hero.protecting': 'Protecting',
    'hero.our_environment': ' Our Environment',
    'hero.subtitle': 'Report environmental incidents instantly. AI-powered classification. Real-time GIS tracking.',
    'hero.btn_report': 'Report an Incident',
    'hero.btn_explore': 'Explore Nearby',

    // Officer Topbar & Titles
    'officer.dashboard': 'Officer Dashboard',
    'officer.subtitle': 'Monitor and manage environmental reports.',
    'officer.assigned': 'Assigned Reports',
    'officer.pending': 'Pending Verification',
    'officer.map': 'GIS Monitoring',
    'officer.notifications': 'Notifications',
    'officer.stats': 'Statistics',
    'officer.details': 'Report Details',

    // Dashboard Overview Stats
    'stats.total_users': 'Total Users',
    'stats.total_reports': 'Total Reports',
    'stats.active_officers': 'Active Officers',
    'stats.system_status': 'System Status',
    'stats.operational': 'Operational 100%',
    'stats.assigned_to_me': 'Assigned to Me',
    'stats.pending_verification': 'Pending Verification',
    'stats.in_progress': 'In Progress',
    'stats.resolved': 'Resolved',
    'stats.reports_by_status': 'Reports by Status (Live Data)',
    'stats.user_demographics': 'User Demographics (Live Data)',
    'stats.category_distribution': 'Category Distribution (Live Data)',
    'stats.recent_activity': 'Recent Activity',
    'stats.latest_reports_desc': 'Latest reports across all statuses.',
    'stats.no_recent_reports': 'No recent reports found',
    'stats.quick_links': 'Quick Links',
    'stats.environmental_overview': 'Environmental Overview',
    'stats.community_snapshot': 'A real-time snapshot of environmental incident reporting across the community.',

    // Citizen Home & Maps
    'citizen.live_map': 'Live Incident Map',
    'citizen.map_desc': 'Real-time environmental incidents across your area',
    'citizen.filter_category': 'Filter by Category',
    'citizen.category_desc': 'Click a category to filter incidents on the map',
    'citizen.nearby_incidents': 'Nearby Incidents',
    'citizen.nearby_desc': 'Recent environmental reports in your area',
    'citizen.view_details': 'View details',

    // Common Buttons & Labels
    'btn.create_user': 'Create New User',
    'btn.add_officer': 'Add New Officer',
    'btn.add_category': 'Add New Category',
    'btn.save_changes': 'Save Changes',
    'btn.cancel': 'Cancel',
    'btn.delete': 'Delete',
    'btn.edit': 'Edit',
    'btn.search': 'Search...',
    'btn.view': 'View',
    'btn.filter': 'Filter',
    'btn.back': 'Back',
    'btn.next': 'Next',
    'btn.submit': 'Submit Report',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('ecoalert_lang');
    return (saved === 'en' || saved === 'vi') ? saved : 'vi';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('ecoalert_lang', lang);
  };

  const toggleLanguage = () => {
    const newLang = language === 'vi' ? 'en' : 'vi';
    setLanguage(newLang);
  };

  const t = (key: string): string => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
