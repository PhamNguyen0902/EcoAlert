import type { ComponentProps } from "react";
import { ClipboardList, FileText } from "lucide-react";
import { SeverityBadge } from "@/components/incidents/incident-status";

type IncidentDetailCardProps = {
  categoryLabel: string;
  reportedAt: string;
  reporterLabel: string;
  description?: string | null;
  severity: ComponentProps<typeof SeverityBadge>["severity"];
};

export function IncidentDetailCard({
  categoryLabel,
  reportedAt,
  reporterLabel,
  description,
  severity,
}: IncidentDetailCardProps) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0b1727] shadow-[0_18px_60px_rgba(0,0,0,0.12)]"
      aria-labelledby="incident-details-heading"
    >
      <div className="border-b border-slate-800/80 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
          </span>

          <div className="min-w-0">
            <h2
              id="incident-details-heading"
              className="text-sm font-semibold text-slate-100 sm:text-[15px]"
            >
              Thông tin sự cố chi tiết
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Dữ liệu được ghi nhận từ phản ánh gốc của người dân.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <dl className="grid overflow-hidden rounded-xl border border-slate-800/80 bg-[#071321]/70 sm:grid-cols-2">
          <div className="border-b border-slate-800/80 p-4 sm:border-r">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Danh mục phân loại
            </dt>
            <dd className="mt-2 text-sm font-semibold leading-6 text-slate-100">
              {categoryLabel || "Chưa xác định"}
            </dd>
          </div>

          <div className="border-b border-slate-800/80 p-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Thời gian ghi nhận
            </dt>
            <dd className="mt-2 text-sm font-semibold tabular-nums leading-6 text-slate-100">
              {reportedAt}
            </dd>
          </div>

          <div className="border-b border-slate-800/80 p-4 sm:border-b-0 sm:border-r">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Người gửi phản ánh
            </dt>
            <dd className="mt-2 flex items-center gap-2 text-sm font-semibold leading-6 text-slate-100">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_7px_rgba(103,232,249,.7)]"
                aria-hidden="true"
              />
              {reporterLabel}
            </dd>
          </div>

          <div className="p-4">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Mức độ ảnh hưởng
            </dt>
            <dd className="mt-2">
              <SeverityBadge severity={severity} />
            </dd>
          </div>
        </dl>

        <div className="mt-4 rounded-xl border border-slate-800/80 bg-[#071321]/55 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Mô tả phản ánh của người dân
            </h3>
          </div>

          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
            {description?.trim() || "Chưa cung cấp mô tả cho phản ánh này."}
          </p>
        </div>
      </div>
    </section>
  );
}
