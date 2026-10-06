import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaGeometryEditor } from "../components/AreaGeometryEditor";
import {
  serviceAreas,
  type AreaGeometry,
  type AreaInput,
  type ServiceArea,
} from "@/services/serviceAreas";

const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const polygon = z.array(z.array(coordinate).min(4)).min(1);
const geometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: polygon }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(polygon).min(1),
  }),
]);
const blank = () => ({
  code: "",
  name: "",
  administrativeLevel: "WARD" as const,
  parentCode: "",
  priority: 0,
  isActive: true,
  assignedOfficerIds: [] as string[],
});
const message = (e: unknown) => {
  const error = e as { response?: { data?: { message?: string } } };
  return (
    error.response?.data?.message || "Không thể lưu khu vực. Vui lòng thử lại."
  );
};
export default function ServiceAreas() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [id, setId] = useState<string>();
  const [form, setForm] = useState<Omit<AreaInput, "geometry">>(blank);
  const [geometry, setGeometry] = useState<AreaGeometry | null>(null);
  const [importText, setImportText] = useState("");
  const areas = useQuery({
    queryKey: ["service-areas", page],
    queryFn: () => serviceAreas.list(page),
  });
  const officers = useQuery({
    queryKey: ["officer-availability"],
    queryFn: serviceAreas.availability,
  });
  const overlaps = useQuery({
    queryKey: ["service-area-overlaps", id],
    queryFn: () => serviceAreas.overlaps(id!),
    enabled: !!id,
  });
  const save = useMutation({
    mutationFn: () => {
      if (!geometry) throw new Error("Vẽ hoặc nhập polygon trước khi lưu");
      return serviceAreas.save({ ...form, geometry }, id);
    },
    onSuccess: (area) => {
      setId(area._id);
      toast.success("Đã lưu khu vực");
      void client.invalidateQueries({ queryKey: ["service-areas"] });
      void client.invalidateQueries({ queryKey: ["service-area-overlaps"] });
    },
    onError: (e) => toast.error(message(e)),
  });
  const deactivate = useMutation({
    mutationFn: serviceAreas.deactivate,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["service-areas"] });
      toast.success("Đã ngừng sử dụng khu vực; lịch sử vẫn được giữ");
    },
    onError: (e) => toast.error(message(e)),
  });
  const edit = (area: ServiceArea) => {
    setId(area._id);
    setForm({
      code: area.code,
      name: area.name,
      administrativeLevel: area.administrativeLevel,
      parentCode: area.parentCode || "",
      priority: area.priority,
      isActive: area.isActive,
      assignedOfficerIds: area.assignedOfficerIds,
    });
    setGeometry(area.geometry);
  };
  const importGeometry = () => {
    try {
      const parsed = JSON.parse(importText);
      setGeometry(
        geometrySchema.parse(
          parsed.type === "Feature" ? parsed.geometry : parsed,
        ),
      );
      toast.success("Đã nhập địa giới; bấm Lưu để xác nhận");
    } catch {
      toast.error(
        "GeoJSON phải là Polygon/MultiPolygon hợp lệ với tọa độ [kinh độ, vĩ độ]",
      );
    }
  };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Khu vực phụ trách</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admin cấu hình địa giới thực tế. Không suy đoán khu vực từ tên địa
          chỉ.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section className="space-y-3 rounded-xl border p-4">
          <Button
            onClick={() => {
              setId(undefined);
              setForm(blank());
              setGeometry(null);
              setImportText("");
            }}
          >
            Tạo khu vực
          </Button>
          {areas.isLoading ? (
            <p>Đang tải khu vực...</p>
          ) : areas.isError ? (
            <p role="alert">
              Không tải được khu vực.{" "}
              <button onClick={() => void areas.refetch()}>Thử lại</button>
            </p>
          ) : !areas.data?.items.length ? (
            <p className="text-sm text-muted-foreground">
              Chưa có khu vực. Hãy tạo địa giới và gán cán bộ.
            </p>
          ) : (
            areas.data.items.map((area) => (
              <div
                key={area._id}
                className={`rounded-lg border p-3 ${id === area._id ? "border-emerald-500" : ""}`}
              >
                <button className="w-full text-left" onClick={() => edit(area)}>
                  <strong className="block break-words">{area.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {area.code} ·{" "}
                    {area.isActive ? "Hoạt động" : "Ngừng sử dụng"} ·{" "}
                    {area.assignedOfficerIds.length} cán bộ
                  </span>
                </button>
                {area.isActive && (
                  <button
                    className="mt-2 text-xs text-amber-500"
                    disabled={deactivate.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          "Ngừng sử dụng khu vực? Các phân công cũ không bị xóa.",
                        )
                      )
                        deactivate.mutate(area._id);
                    }}
                  >
                    Ngừng sử dụng
                  </button>
                )}
              </div>
            ))
          )}
          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * 20 >= (areas.data?.total || 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau
            </Button>
          </div>
        </section>
        <form
          className="min-w-0 space-y-4 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h2 className="font-semibold">
            {id ? "Chỉnh sửa khu vực" : "Khu vực mới"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Mã khu vực
              <Input
                required
                maxLength={80}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Tên khu vực
              <Input
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Cấp hành chính
              <select
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={form.administrativeLevel}
                onChange={(e) =>
                  setForm({
                    ...form,
                    administrativeLevel: e.target
                      .value as AreaInput["administrativeLevel"],
                  })
                }
              >
                <option value="WARD">Phường/Xã</option>
                <option value="DISTRICT">Quận/Huyện</option>
                <option value="CUSTOM">Khu vực tùy chỉnh</option>
              </select>
            </label>
            <label className="text-sm">
              Mã khu vực cha (tùy chọn)
              <Input
                maxLength={80}
                value={form.parentCode}
                onChange={(e) =>
                  setForm({ ...form, parentCode: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              Ưu tiên khi chồng lấn
              <Input
                type="number"
                min={-1000}
                max={1000}
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Hoạt động
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Dùng công cụ polygon bên phải để vẽ, sửa đỉnh hoặc xóa. Có thể vẽ
            nhiều polygon. Khu vực chồng lấn được chọn theo ưu tiên cao nhất,
            sau đó mã và ID; kiểm tra cảnh báo trong xem trước phân công.
          </p>
          <AreaGeometryEditor value={geometry} onChange={setGeometry} />
          {!!overlaps.data?.length && (
            <p role="status" className="text-xs text-amber-500">
              Địa giới đã lưu giao/chạm {overlaps.data.length} khu vực đang hoạt
              động: {overlaps.data.map((a) => a.code).join(", ")}. Kiểm tra ưu
              tiên và ranh giới trước khi phân công.
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer">
              Nhập GeoJSON (Polygon/MultiPolygon hoặc Feature)
            </summary>
            <label className="sr-only" htmlFor="area-geojson">
              GeoJSON địa giới
            </label>
            <textarea
              id="area-geojson"
              className="mt-2 h-24 w-full rounded border bg-background p-2 font-mono text-xs"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={importGeometry}
            >
              Nhập địa giới
            </Button>
          </details>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">Cán bộ phụ trách</legend>
            {officers.isLoading ? (
              <p>Đang tải cán bộ...</p>
            ) : officers.isError ? (
              <p role="alert">
                Không tải được cán bộ.{" "}
                <button type="button" onClick={() => void officers.refetch()}>
                  Thử lại
                </button>
              </p>
            ) : !officers.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Chưa có tài khoản Officer.
              </p>
            ) : (
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {officers.data.map((row) => (
                  <label
                    key={row.officer._id}
                    className="flex items-start gap-2 rounded border p-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={form.assignedOfficerIds.includes(
                        row.officer._id,
                      )}
                      disabled={
                        !row.officer.isActive &&
                        !form.assignedOfficerIds.includes(row.officer._id)
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          assignedOfficerIds: e.target.checked
                            ? [...form.assignedOfficerIds, row.officer._id]
                            : form.assignedOfficerIds.filter(
                                (v) => v !== row.officer._id,
                              ),
                        })
                      }
                    />
                    <span className="min-w-0">
                      <strong className="block break-words">
                        {row.officer.fullName}
                      </strong>
                      <span className="text-xs text-muted-foreground">
                        {row.officer.isActive
                          ? "Hoạt động"
                          : "Tài khoản ngừng hoạt động"}{" "}
                        ·{" "}
                        {row.shiftStatus === "ON_SHIFT"
                          ? "Trong ca"
                          : "Ngoài ca"}{" "}
                        · {row.activeTaskCount} nhiệm vụ · {row.workloadLevel}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <Button disabled={save.isPending || !geometry}>
            {save.isPending ? "Đang lưu..." : "Lưu khu vực"}
          </Button>
        </form>
      </div>
    </div>
  );
}
