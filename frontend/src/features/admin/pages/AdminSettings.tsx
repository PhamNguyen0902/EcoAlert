import { useMemo } from "react";
import {
  SlidersHorizontal,
  Wifi,
  WifiOff,
  BrainCircuit,
  Crosshair,
  Sun,
  Moon,
  Monitor,
  Globe,
  ShieldCheck,
  Server,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSocket } from "@/contexts/SocketContext";
import { useAlerts } from "@/hooks/hooks";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { SoundToggle } from "@/components/ui/sound-toggle";
import { getAlertDisplayConfidence } from "@/lib/ai-confidence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Trang Cài đặt Hệ thống & Cấu hình Vận hành (/admin/settings)
export default function AdminSettings() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { isConnected, socket } = useSocket();
  const { data: alertsData, isSuccess: apiReachable } = useAlerts(1, 20);

  const aiMetrics = useMemo(() => {
    const items = alertsData?.items ?? [];
    const resolvedConfidences = items
      .map((item) => getAlertDisplayConfidence(item))
      .filter((c) => c.value !== null);
    const avg =
      resolvedConfidences.length > 0
        ? Math.round(
            (resolvedConfidences.reduce((acc, c) => acc + (c.value ?? 0), 0) /
              resolvedConfidences.length) *
              100,
          )
        : null;
    return {
      sampleSize: items.length,
      confidentCount: resolvedConfidences.length,
      avgPercent: avg,
    };
  }, [alertsData?.items]);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">
              Cài đặt Hệ thống
            </h1>
            <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              System Configuration
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Tùy chỉnh giao diện làm việc, ngôn ngữ, âm báo sự cố, kiểm tra kết
            nối thời gian thực và tiêu chuẩn kiểm duyệt AI / GPS.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Tùy chọn Giao diện & Thông báo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
              Tùy chọn Giao diện & Thông báo
            </CardTitle>
            <CardDescription>
              Đồng bộ tức thời trên trình duyệt quản trị viên hiện tại.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Chế độ Sáng / Tối / Hệ thống */}
            <div className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold">Chế độ Giao diện (Theme)</p>
                <p className="text-xs text-muted-foreground">
                  Đang chọn:{" "}
                  <span className="font-medium uppercase text-foreground">
                    {theme}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => setTheme("light")}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Sun className="h-3.5 w-3.5" />
                  Sáng
                </Button>
                <Button
                  size="sm"
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Moon className="h-3.5 w-3.5" />
                  Tối
                </Button>
                <Button
                  size="sm"
                  variant={theme === "system" ? "default" : "outline"}
                  onClick={() => setTheme("system")}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Hệ thống
                </Button>
                <ThemeToggle />
              </div>
            </div>

            {/* Ngôn ngữ hiển thị */}
            <div className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold">
                  Ngôn ngữ Hiển thị (Language)
                </p>
                <p className="text-xs text-muted-foreground">
                  Chuyển đổi song ngữ Tiếng Việt (VI) và Tiếng Anh (EN).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={language === "vi" ? "default" : "outline"}
                  onClick={() => setLanguage("vi")}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Tiếng Việt
                </Button>
                <Button
                  size="sm"
                  variant={language === "en" ? "default" : "outline"}
                  onClick={() => setLanguage("en")}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Globe className="h-3.5 w-3.5" />
                  English
                </Button>
                <LanguageToggle className="shadow-none" />
              </div>
            </div>

            {/* Âm thanh cảnh báo sự cố mới */}
            <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="text-sm font-semibold">
                  Âm thanh Cảnh báo Sự cố Mới
                </p>
                <p className="text-xs text-muted-foreground">
                  Phát âm báo khi có báo cáo mới hoặc kết quả phân tích AI qua
                  WebSocket.
                </p>
              </div>
              <SoundToggle />
            </div>
          </CardContent>
        </Card>

        {/* 2. Trạng thái Kết nối Hệ thống */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4 text-emerald-500" />
              Trạng thái Kết nối Hệ thống Thời gian thực
            </CardTitle>
            <CardDescription>
              Giám sát kênh truyền sự kiện Socket.IO và cổng API Gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isConnected
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500"
                  }`}
                >
                  {isConnected ? (
                    <Wifi className="h-5 w-5" />
                  ) : (
                    <WifiOff className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Socket.IO Realtime Channel
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Socket ID: {socket?.id || "Đang chờ phiên kết nối"}
                  </p>
                </div>
              </div>
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={
                  isConnected
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : ""
                }
              >
                {isConnected ? "Đã kết nối" : "Ngắt kết nối"}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    EcoAlert API Gateway (`/v1/alerts`)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Đồng bộ {alertsData?.total ?? 0} bản ghi sự cố trên hệ thống
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-500"
              >
                {apiReachable ? "Hoạt động ổn định" : "Đang kiểm tra"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* 3. Thông số Ngưỡng Kiểm duyệt AI & Định vị Hiện trường */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuit className="h-4 w-4 text-emerald-500" />
              Tiêu chuẩn Ngưỡng Kiểm duyệt AI & Định vị GPS Hiện trường
            </CardTitle>
            <CardDescription>
              Thông số kỹ thuật đang áp dụng cho luồng phân tích AI Vision và
              nghiệm thu 3 bước của Cán bộ hiện trường.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Độ tin cậy AI (OpenRouter + YOLO)
                  </span>
                  <BrainCircuit className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-emerald-500">
                  {aiMetrics.avgPercent !== null
                    ? `${aiMetrics.avgPercent}%`
                    : "≥ 75%"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đã phân tích {aiMetrics.confidentCount}/{aiMetrics.sampleSize}{" "}
                  mẫu gần nhất qua `getAlertDisplayConfidence`.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Bán kính Đối chiếu GPS Hiện trường
                  </span>
                  <Crosshair className="h-4 w-4 text-blue-500" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-blue-500">
                  ≤ 100m
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Yêu cầu GPS tươi (`maximumAge: 0`, `enableHighAccuracy: true`)
                  khi Cán bộ Check-in và Check-out.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Tiêu chuẩn Ảnh Nghiệm thu
                  </span>
                  <ShieldCheck className="h-4 w-4 text-purple-500" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-purple-500">
                  Khung 3:4 · Ghost 35%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Đối chiếu góc chụp Trước/Sau và kiểm tra tự động không còn vật
                  thể rác tồn đọng.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
