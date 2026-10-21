import { useState } from "react";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  BookOpen,
  Scale,
  Route,
  Trash2,
  CheckCircle2,
  MapPin,
  Camera,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Search,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { getIncidentCategoryLabel } from "@/lib/incident-presentation";

interface WasteCategoryGuide {
  code:
    | "MUNICIPAL_WASTE"
    | "CONSTRUCTION_DEBRIS"
    | "BULKY_WASTE"
    | "PLASTIC_RECYCLABLE"
    | "HAZARDOUS_WASTE"
    | "OTHER_WASTE";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  priorityLabel: string;
  priorityBadgeClass: string;
  traits: string;
  handlingGuide: string;
  slaHours: string;
}

const WASTE_CATEGORIES: WasteCategoryGuide[] = [
  {
    code: "HAZARDOUS_WASTE",
    priority: "CRITICAL",
    priorityLabel: "Khẩn cấp (Critical)",
    priorityBadgeClass:
      "border-rose-600/40 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    traits:
      "Pin, ắc quy chì, bóng đèn huỳnh quang, bao bì hóa chất/thuốc bảo vệ thực vật, dầu nhớt thải, kim tiêm hoặc chất thải y tế lây nhiễm.",
    handlingGuide:
      "Cách ly khu vực ngay lập tức, điều phối đội thu gom chuyên trách có trang bị bảo hộ đạt chuẩn, không trộn lẫn với rác sinh hoạt.",
    slaHours: "2 - 4 giờ",
  },
  {
    code: "CONSTRUCTION_DEBRIS",
    priority: "HIGH",
    priorityLabel: "Ưu tiên cao (High)",
    priorityBadgeClass:
      "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    traits:
      "Gạch vỡ, bê tông, vữa xây dựng, đất đá san lấp, tấm thạch cao, tôn sắt vụn đổ trộm ven đường hoặc lấn chiếm lòng lề đường.",
    handlingGuide:
      "Xác định khối lượng ước tính qua ảnh AI, điều xe cơ giới/xe tải ben thu dọn, kiểm tra camera lân cận để lập biên bản xử phạt.",
    slaHours: "6 - 12 giờ",
  },
  {
    code: "BULKY_WASTE",
    priority: "HIGH",
    priorityLabel: "Ưu tiên cao (High)",
    priorityBadgeClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    traits:
      "Bàn ghế hỏng, tủ gỗ, nệm cũ, sofa, gốc cây lớn, thiết bị gia dụng kích thước lớn gây cản trở giao thông hoặc che khuất tầm nhìn.",
    handlingGuide:
      "Bố trí phương tiện thu gom rác cồng kềnh chuyên dụng hoặc tháo dỡ sơ bộ tại điểm tập kết trước khi vận chuyển.",
    slaHours: "12 - 24 giờ",
  },
  {
    code: "MUNICIPAL_WASTE",
    priority: "MEDIUM",
    priorityLabel: "Trung bình (Medium)",
    priorityBadgeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    traits:
      "Túi rác sinh hoạt hộ gia đình, thức ăn thừa, lá cây, rác hữu cơ tồn đọng quá tải quanh thùng rác công cộng hoặc điểm tập kết tự phát.",
    handlingGuide:
      "Điều phối cán bộ môi trường trong ca trực thuộc Khu vực Phục vụ (ServiceArea) gần nhất thu gom và phun khử mùi.",
    slaHours: "Trong ngày (≤ 12 giờ)",
  },
  {
    code: "PLASTIC_RECYCLABLE",
    priority: "MEDIUM",
    priorityLabel: "Trung bình (Medium)",
    priorityBadgeClass:
      "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    traits:
      "Chai nhựa PET, túi nilon số lượng lớn, thùng xốp, vỏ lon kim loại, bìa carton tập kết sai quy định hoặc trôi nổi ven kênh rạch.",
    handlingGuide:
      "Phân loại tại nguồn khi thu gom để chuyển giao cho đơn vị tái chế, tránh phát tán vi nhựa ra nguồn nước.",
    slaHours: "12 - 24 giờ",
  },
  {
    code: "OTHER_WASTE",
    priority: "LOW",
    priorityLabel: "Tiêu chuẩn (Normal)",
    priorityBadgeClass:
      "border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-400",
    traits:
      "Các loại chất thải hỗn hợp chưa xác định rõ danh mục, bùn đất sau mưa ngập hoặc điểm ô nhiễm cảnh quan đô thị khác.",
    handlingGuide:
      "Admin kiểm tra lại bằng công cụ Kiểm định AI Vision để phân loại chính xác trước khi giao việc cho cán bộ hiện trường.",
    slaHours: "24 giờ",
  },
];

interface LegalPenaltyItem {
  clause: string;
  violation: string;
  fineRange: string;
  remedialAction: string;
}

const DECREE_45_PENALTIES: LegalPenaltyItem[] = [
  {
    clause: "Điều 25, Khoản 1 (Điểm c, d)",
    violation:
      "Vứt, thải, bỏ rác thải sinh hoạt trên vỉa hè, lòng đường hoặc vào hệ thống thoát nước thải đô thị / hệ thống thoát nước mặt.",
    fineRange: "1.000.000đ – 2.000.000đ",
    remedialAction:
      "Buộc khôi phục lại tình trạng ban đầu; thu dọn toàn bộ rác thải vi phạm.",
  },
  {
    clause: "Điều 25, Khoản 2",
    violation:
      "Vận chuyển nguyên liệu, vật liệu, hàng hóa không che chắn hoặc để rơi vãi ra môi trường trong khi tham gia giao thông.",
    fineRange: "2.000.000đ – 4.000.000đ",
    remedialAction:
      "Buộc thu gom chất thải rơi vãi và khắc phục tình trạng ô nhiễm môi trường.",
  },
  {
    clause: "Điều 26, Khoản 1 - 2",
    violation:
      "Hộ gia đình, cá nhân không phân loại chất thải rắn sinh hoạt theo quy định; không sử dụng bao bì chứa chất thải đúng quy chuẩn.",
    fineRange: "500.000đ – 1.000.000đ",
    remedialAction:
      "Nhắc nhở, yêu cầu phân loại lại trước khi đơn vị thu gom tiếp nhận.",
  },
  {
    clause: "Điều 26, Khoản 4 - 6",
    violation:
      "Đổ, thải chất thải rắn công nghiệp thông thường, phế thải xây dựng trái quy định về bảo vệ môi trường (tùy theo khối lượng vi phạm).",
    fineRange: "20.000.000đ – 100.000.000đ+",
    remedialAction:
      "Buộc chuyển giao chất thải cho đơn vị có chức năng xử lý; chi trả toàn bộ chi phí trưng cầu giám định và khắc phục.",
  },
  {
    clause: "Điều 29",
    violation:
      "Vi phạm các quy định về bảo vệ môi trường liên quan đến quản lý chất thải nguy hại (không thu gom, lưu giữ hoặc chuyển giao trái phép).",
    fineRange: "10.000.000đ – 250.000.000đ",
    remedialAction:
      "Đình chỉ hoạt động nguồn phát sinh chất thải, buộc thực hiện các biện pháp khắc phục ô nhiễm môi trường theo quy định.",
  },
];

export default function AdminHelp() {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = WASTE_CATEGORIES.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const label = getIncidentCategoryLabel(item.code, language).toLowerCase();
    return (
      item.code.toLowerCase().includes(q) ||
      label.includes(q) ||
      item.traits.toLowerCase().includes(q) ||
      item.handlingGuide.toLowerCase().includes(q)
    );
  });

  const filteredLegalItems = DECREE_45_PENALTIES.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.clause.toLowerCase().includes(q) ||
      item.violation.toLowerCase().includes(q) ||
      item.fineRange.toLowerCase().includes(q) ||
      item.remedialAction.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Trợ giúp & Sổ tay Vận hành
            </h1>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              Chuẩn nghiệp vụ EcoAlert
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tài liệu tra cứu nhanh quy chuẩn phân loại 6 nhóm chất thải đô thị,
            quy trình điều phối & nghiệm thu hiện trường 3 bước và căn cứ pháp
            lý xử phạt hành chính.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tra cứu danh mục, điều khoản..."
            className="h-9 pl-9 text-sm"
          />
        </div>
      </div>

      {/* Section 2: Quy trình Điều phối & Nghiệm thu 3 Bước */}
      <Card className="border-emerald-500/20 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Route className="h-5 w-5 text-emerald-500" />
              Quy trình Điều phối Thông minh & Nghiệm thu Hiện trường 3 Bước
            </CardTitle>
            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <Link to="/admin/dispatch">
                Mở Điều phối & Ca trực
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Giai đoạn A: Tiếp nhận & Phân tích */}
            <div className="rounded-xl border bg-muted/25 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Sparkles className="h-3.5 w-3.5" />
                  Giai đoạn 1: Tiếp nhận & AI Vision
                </span>
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Người dân gửi phản ánh ➔ AI định danh
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Ảnh hiện trường và tọa độ GPS từ ứng dụng Citizen được mô hình
                AI Vision phân tích tự động để gắn nhãn 1 trong 6 danh mục rác
                thải, mức độ nghiêm trọng và điểm độ tin cậy (Confidence Score).
              </p>
            </div>

            {/* Giai đoạn B: Định tuyến ServiceArea & OSRM */}
            <div className="rounded-xl border bg-muted/25 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <MapPin className="h-3.5 w-3.5" />
                  Giai đoạn 2: Điều phối Địa không gian
                </span>
                <ArrowRight className="hidden h-4 w-4 text-muted-foreground lg:block" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Đối chiếu Đa giác ServiceArea & Lộ trình OSRM
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Hệ thống kiểm tra điểm sự cố nằm trong đa giác{" "}
                <code>ServiceArea</code> nào, lọc danh sách Cán bộ (Officer)
                đang trong ca trực, ít tải công việc nhất và tính khoảng cách di
                chuyển thực tế qua OSRM để gợi ý phân công tối ưu.
              </p>
            </div>

            {/* Giai đoạn C: 3 Bước Cán bộ Hiện trường */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Giai đoạn 3: 3 Bước Hiện trường & Nghiệm thu
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Check-in GPS ➔ Xử lý ➔ Check-out Đối chiếu Ảnh
              </h3>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    B1. Check-in:
                  </span>
                  <span>
                    Xác thực khoảng cách GPS tại hiện trường (ngưỡng ≤ 100m).
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    B2. Xử lý:
                  </span>
                  <span>
                    Thu dọn chất thải, ghi nhận nhật ký hiện trường.
                  </span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    B3. Check-out:
                  </span>
                  <span>
                    Chụp ảnh nghiệm thu đúng góc chụp ban đầu (Ghost Overlay) để
                    Admin đối chiếu <strong>Trước / Sau</strong> và đóng hồ sơ.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Quy chuẩn 6 Danh mục Rác thải Đô thị */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Trash2 className="h-5 w-5 text-emerald-500" />
              Bảng Tra cứu Quy chuẩn 6 Danh mục Rác thải Đô thị
            </CardTitle>
            <Button variant="outline" size="sm" asChild className="h-8 text-xs">
              <Link to="/admin/ai-vision">
                Kiểm định bằng AI Vision
                <Camera className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="py-3 px-4 font-semibold">Mã & Danh mục</th>
                  <th className="py-3 px-4 font-semibold">Mức độ ưu tiên</th>
                  <th className="py-3 px-4 font-semibold">
                    Đặc điểm nhận diện hiện trường & AI
                  </th>
                  <th className="py-3 px-4 font-semibold">
                    Hướng dẫn điều phối xử lý
                  </th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">
                    SLA khuyến nghị
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Không tìm thấy danh mục phù hợp với từ khóa "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr
                      key={cat.code}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors align-top"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          {getIncidentCategoryLabel(cat.code, language)}
                        </div>
                        <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                          {cat.code}
                        </code>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`font-semibold ${cat.priorityBadgeClass}`}
                        >
                          {cat.priorityLabel}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-xs leading-relaxed text-foreground/90 max-w-xs">
                        {cat.traits}
                      </td>
                      <td className="py-3.5 px-4 text-xs leading-relaxed text-muted-foreground max-w-xs">
                        {cat.handlingGuide}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium whitespace-nowrap">
                        {cat.slaHours}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Tra cứu Căn cứ Pháp lý (Nghị định 45/2022/NĐ-CP) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Scale className="h-5 w-5 text-emerald-500" />
                Tra cứu Căn cứ Pháp lý: Nghị định 45/2022/NĐ-CP
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Quy định về xử phạt vi phạm hành chính trong lĩnh vực bảo vệ môi
                trường (áp dụng đối với cá nhân; mức phạt đối với tổ chức bằng
                02 lần mức phạt cá nhân).
              </p>
            </div>
            <Badge variant="secondary" className="text-xs font-normal">
              <BookOpen className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
              Hiệu lực hiện hành
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="py-3 px-4 font-semibold">Điều khoản</th>
                  <th className="py-3 px-4 font-semibold">
                    Hành vi vi phạm phổ biến
                  </th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">
                    Khung tiền phạt (Cá nhân)
                  </th>
                  <th className="py-3 px-4 font-semibold">
                    Biện pháp khắc phục hậu quả
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLegalItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Không tìm thấy điều khoản phù hợp với từ khóa "
                      {searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredLegalItems.map((item) => (
                    <tr
                      key={item.clause}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors align-top"
                    >
                      <td className="py-3.5 px-4 font-semibold text-foreground whitespace-nowrap">
                        {item.clause}
                      </td>
                      <td className="py-3.5 px-4 text-xs leading-relaxed text-foreground/90 max-w-md">
                        {item.violation}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {item.fineRange}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs leading-relaxed text-muted-foreground max-w-sm">
                        <span className="inline-flex items-start gap-1.5">
                          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span>{item.remedialAction}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Footer note */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>
            Cần kiểm tra trạng thái kết nối Socket.IO hoặc ngưỡng độ tin cậy AI?
            Truy cập trang <strong>Cài đặt hệ thống</strong> ở thanh điều hướng
            bên trái.
          </span>
        </div>
        <Button variant="outline" size="sm" asChild className="h-8 text-xs">
          <Link to="/admin/settings">Mở Cài đặt hệ thống</Link>
        </Button>
      </div>
    </div>
  );
}
