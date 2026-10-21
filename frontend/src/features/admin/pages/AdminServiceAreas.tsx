import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Hexagon,
  Plus,
  Save,
  Trash2,
  Users,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import {
  serviceAreas,
  type AreaGeometry,
  type AreaInput,
  type ServiceArea,
} from "@/services/serviceAreas";
import { AreaGeometryEditor } from "../components/AreaGeometryEditor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getApiErrorMessage } from "@/lib/api-error";

// Trang Quản lý Khu vực Phục vụ (Service Areas) & Ranh giới Địa bàn GIS
export default function AdminServiceAreas() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [administrativeLevel, setAdministrativeLevel] = useState<
    "WARD" | "DISTRICT" | "CUSTOM"
  >("WARD");
  const [parentCode, setParentCode] = useState("");
  const [priority, setPriority] = useState<number>(10);
  const [isActive, setIsActive] = useState(true);
  const [selectedOfficerIds, setSelectedOfficerIds] = useState<string[]>([]);
  const [geometry, setGeometry] = useState<AreaGeometry | null>(null);

  const areasQuery = useQuery({
    queryKey: ["service-areas", page],
    queryFn: () => serviceAreas.list(page),
  });

  const officersQuery = useQuery({
    queryKey: ["officer-availability"],
    queryFn: () => serviceAreas.availability(),
  });

  const overlapsQuery = useQuery({
    queryKey: ["service-area-overlaps", editingId],
    queryFn: () => serviceAreas.overlaps(editingId!),
    enabled: Boolean(editingId),
  });

  const saveMutation = useMutation({
    mutationFn: (input: { payload: AreaInput; id?: string }) =>
      serviceAreas.save(input.payload, input.id),
    onSuccess: () => {
      toast.success(
        editingId
          ? "Đã cập nhật khu vực phục vụ."
          : "Đã tạo khu vực phục vụ mới.",
      );
      void queryClient.invalidateQueries({ queryKey: ["service-areas"] });
      if (editingId) {
        void queryClient.invalidateQueries({
          queryKey: ["service-area-overlaps", editingId],
        });
      }
    },
    onError: (err) => {
      toast.error(
        getApiErrorMessage(err, "Không thể lưu khu vực phục vụ. Vui lòng kiểm tra ranh giới đa giác."),
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => serviceAreas.deactivate(id),
    onSuccess: () => {
      toast.success("Đã ngừng kích hoạt khu vực phục vụ.");
      void queryClient.invalidateQueries({ queryKey: ["service-areas"] });
      resetForm();
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Không thể ngừng kích hoạt khu vực."));
    },
  });

  const resetForm = () => {
    setEditingId(undefined);
    setCode("");
    setName("");
    setAdministrativeLevel("WARD");
    setParentCode("");
    setPriority(10);
    setIsActive(true);
    setSelectedOfficerIds([]);
    setGeometry(null);
  };

  const selectAreaForEdit = (area: ServiceArea) => {
    setEditingId(area._id);
    setCode(area.code);
    setName(area.name);
    setAdministrativeLevel(area.administrativeLevel);
    setParentCode(area.parentCode || "");
    setPriority(area.priority ?? 10);
    setIsActive(area.isActive);
    setSelectedOfficerIds(area.assignedOfficerIds || []);
    setGeometry(area.geometry || null);
  };

  const toggleOfficer = (officerId: string) => {
    setSelectedOfficerIds((prev) =>
      prev.includes(officerId)
        ? prev.filter((id) => id !== officerId)
        : [...prev, officerId],
    );
  };

  const handleSave = () => {
    if (!code.trim() || !name.trim()) {
      toast.error("Vui lòng nhập đầy đủ Mã khu vực và Tên khu vực.");
      return;
    }
    if (!geometry) {
      toast.error("Vui lòng vẽ ranh giới đa giác trên bản đồ trước khi lưu.");
      return;
    }

    const payload: AreaInput = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      administrativeLevel,
      parentCode: parentCode.trim() || undefined,
      geometry,
      assignedOfficerIds: selectedOfficerIds,
      isActive,
      priority: Number(priority) || 1,
    };

    saveMutation.mutate({ payload, id: editingId });
  };

  if (areasQuery.isLoading) {
    return <LoadingSpinner label="Đang tải danh sách khu vực phục vụ..." />;
  }

  const areas = areasQuery.data?.items ?? [];
  const officers = officersQuery.data ?? [];
  const overlaps = overlapsQuery.data ?? [];

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">
              Khu vực Phục vụ & Địa bàn GIS
            </h1>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              Polygon GeoJSON
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Thiết lập ranh giới đa giác địa bàn và gán đội ngũ cán bộ phụ trách
            để hệ thống tự động phân công sự cố.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={resetForm}
          className="gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Tạo khu vực mới
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Cột trái: Danh sách khu vực hiện có */}
        <div className="space-y-4 xl:col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Hexagon className="h-4 w-4 text-emerald-500" />
                Danh sách Khu vực ({areasQuery.data?.total ?? areas.length})
              </CardTitle>
              <CardDescription>
                Nhấp vào một khu vực để xem ranh giới trên bản đồ hoặc chỉnh sửa
                cán bộ phụ trách.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {areas.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Chưa có khu vực phục vụ nào được cấu hình.
                </p>
              ) : (
                <div className="divide-y border-t">
                  {areas.map((area) => {
                    const selected = editingId === area._id;
                    return (
                      <div
                        key={area._id}
                        onClick={() => selectAreaForEdit(area)}
                        className={`flex cursor-pointer items-start justify-between gap-3 p-4 transition-colors ${
                          selected
                            ? "bg-emerald-500/10"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {area.name}
                            </span>
                            <Badge variant="outline" className="font-mono text-[11px]">
                              {area.code}
                            </Badge>
                            <Badge
                              variant={area.isActive ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {area.isActive ? "Đang hoạt động" : "Ngừng"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Cấp:{" "}
                            {area.administrativeLevel === "WARD"
                              ? "Phường / Xã"
                              : area.administrativeLevel === "DISTRICT"
                                ? "Quận / Huyện"
                                : "Tùy chỉnh"}{" "}
                            · Ưu tiên: {area.priority} ·{" "}
                            {area.assignedOfficerIds?.length ?? 0} cán bộ
                          </p>
                        </div>

                        {area.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-rose-500 hover:text-rose-600"
                            title="Ngừng kích hoạt khu vực"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                confirm(
                                  `Ngừng kích hoạt khu vực "${area.name}" (${area.code})?`,
                                )
                              ) {
                                deactivateMutation.mutate(area._id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between border-t p-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Trang trước
                </Button>
                <span className="text-xs text-muted-foreground">
                  Trang {page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={areas.length < 20}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải: Trình chỉnh sửa Bản đồ Đa giác & Form cấu hình */}
        <div className="space-y-6 xl:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {editingId
                      ? `Chỉnh sửa Khu vực: ${name || code}`
                      : "Thêm Khu vực Phục vụ Mới"}
                  </CardTitle>
                  <CardDescription>
                    Sử dụng công cụ vẽ đa giác ở góc phải trên của bản đồ để khoanh
                    vùng địa bàn.
                  </CardDescription>
                </div>
                {editingId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    className="gap-1.5 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Hủy chọn
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bản đồ vẽ ranh giới AreaGeometryEditor */}
              <AreaGeometryEditor value={geometry} onChange={setGeometry} />

              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Trạng thái hình học GeoJSON:
                </span>
                {geometry ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Đã xác định ({geometry.type})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-500">
                    <AlertTriangle className="h-4 w-4" />
                    Chưa có vùng đa giác trên bản đồ
                  </span>
                )}
              </div>

              {overlaps.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">
                  Phát hiện {overlaps.length} khu vực chồng lấn:{" "}
                  {overlaps.map((o) => `${o.name} (${o.code})`).join(", ")}. Hệ
                  thống sẽ xét theo độ ưu tiên cao nhất khi tự động điều phối.
                </div>
              )}

              {/* Thông tin hành chính */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Mã khu vực *</label>
                  <Input
                    placeholder="VD: QGV-P04"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Tên khu vực *</label>
                  <Input
                    placeholder="VD: Phường 4 - Quận Gò Vấp"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Cấp hành chính</label>
                  <select
                    value={administrativeLevel}
                    onChange={(e) =>
                      setAdministrativeLevel(
                        e.target.value as "WARD" | "DISTRICT" | "CUSTOM",
                      )
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="WARD">Phường / Xã (WARD)</option>
                    <option value="DISTRICT">Quận / Huyện (DISTRICT)</option>
                    <option value="CUSTOM">Khu vực tùy chỉnh (CUSTOM)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Độ ưu tiên điều phối
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Chọn Cán bộ phụ trách khu vực */}
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Cán bộ phụ trách địa bàn ({selectedOfficerIds.length} đã chọn)
                </label>
                <div className="max-h-48 divide-y overflow-y-auto rounded-lg border">
                  {officers.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      Không có dữ liệu cán bộ.
                    </p>
                  ) : (
                    officers.map((item) => {
                      const checked = selectedOfficerIds.includes(
                        item.officer._id,
                      );
                      return (
                        <label
                          key={item.officer._id}
                          className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-xs hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOfficer(item.officer._id)}
                              className="h-4 w-4 rounded border-input"
                            />
                            <div>
                              <p className="font-medium text-foreground">
                                {item.officer.fullName}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {item.officer.email}
                              </p>
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {item.shiftStatus === "ON_SHIFT"
                              ? "Trong ca"
                              : "Ngoài ca"}{" "}
                            · {item.activeTaskCount} việc
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending
                    ? "Đang lưu..."
                    : editingId
                      ? "Cập nhật Khu vực"
                      : "Lưu Khu vực Mới"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
