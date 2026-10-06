import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { serviceAreas, assignmentReasonLabel } from "@/services/serviceAreas";
export function AssignmentPreview({ id }: { id: string }) {
  const client = useQueryClient();
  const preview = useQuery({
    queryKey: ["assignment-preview", id],
    queryFn: () => serviceAreas.preview(id),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const assign = useMutation({
    mutationFn: () => serviceAreas.autoAssign(id),
    onSuccess: (r) => {
      r.assigned
        ? toast.success("Đã tự động phân công cán bộ")
        : toast.error(assignmentReasonLabel(r.reason));
      void client.invalidateQueries({ queryKey: ["assignment-preview", id] });
      void client.invalidateQueries({ queryKey: ["alert", id] });
      void client.invalidateQueries({ queryKey: ["alerts"] });
      void client.invalidateQueries({ queryKey: ["officer-availability"] });
    },
    onError: () => toast.error("Không thể phân công. Vui lòng thử lại."),
  });
  const data = preview.data;
  return (
    <section className="space-y-3 rounded-lg border border-emerald-500/30 p-3 text-sm">
      <h3 className="font-semibold">Xem trước phân công theo khu vực</h3>
      {preview.isLoading ? (
        <p>Đang kiểm tra khu vực và ca trực...</p>
      ) : preview.isError ? (
        <p role="alert">
          Không tải được gợi ý.{" "}
          <button onClick={() => void preview.refetch()}>Thử lại</button>
        </p>
      ) : (
        <>
          <p>{assignmentReasonLabel(data?.reason)}</p>
          {data?.match?.area && (
            <p className="text-xs text-muted-foreground">
              {data.match.area.name} · {data.match.area.code}
            </p>
          )}
          {data?.match && data.match.overlaps.length > 1 && (
            <p role="status" className="text-xs text-amber-500">
              Có {data.match.overlaps.length} khu vực chồng lấn:{" "}
              {data.match.overlaps.map((a) => a.code).join(", ")}. Ưu tiên cao
              nhất, sau đó mã/ID quyết định khu vực được chọn.
            </p>
          )}
          <ul className="space-y-2">
            {data?.candidates?.map((c) => (
              <li key={c.officer._id} className="text-xs">
                <strong>{c.officer.fullName}</strong> ·{" "}
                {c.shiftStatus === "ON_SHIFT" ? "Trong ca" : "Ngoài ca"} ·{" "}
                {c.activeTaskCount} nhiệm vụ
                {c.officer._id === data.selectedOfficerId
                  ? " · Được đề xuất"
                  : ""}
                {c.exclusion ? ` · ${c.exclusion}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={assign.isPending}
        onClick={() => assign.mutate()}
      >
        {assign.isPending ? "Đang phân công..." : "Thử phân công tự động"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Xem trước không thay đổi báo cáo. Điều kiện được kiểm tra lại khi phân
        công.
      </p>
    </section>
  );
}
