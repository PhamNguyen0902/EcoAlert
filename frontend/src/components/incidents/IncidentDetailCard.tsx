import type { ComponentProps } from "react";
import { Info } from "lucide-react";
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
      className="rounded-[14px] border border-slate-800/90 bg-[#0b1727] p-4 sm:p-5"
      aria-labelledby="incident-details-heading"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-400/15 bg-cyan-400/[0.07] text-cyan-300">
          <Info className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2
          id="incident-details-heading"
          className="text-sm font-semibold text-slate-100"
        >
          Thông tin sự cố chi tiết
        </h2>
      </div>

      <div className="mt-5">
        <dl className="grid gap-x-10 gap-y-6 rounded-xl border border-slate-800/75 bg-[#071321] p-4 sm:grid-cols-2 sm:p-5">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Danh mục phân loại
            </dt>
            <dd className="mt-1.5 break-words text-sm font-semibold leading-6 text-slate-100">
              {categoryLabel || "Chưa xác định"}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Thời gian ghi nhận
            </dt>
            <dd className="mt-1.5 break-words text-sm font-semibold tabular-nums leading-6 text-slate-100">
              {reportedAt}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Người gửi phản ánh
            </dt>
            <dd className="mt-1.5 break-words text-sm font-semibold leading-6 text-slate-100">
              {reporterLabel}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Mức độ ảnh hưởng
            </dt>
            <dd className="mt-1.5">
              <SeverityBadge severity={severity} />
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Mô tả phản ánh của người dân
          </h3>
          <div className="mt-2.5 rounded-[10px] border border-slate-800/80 bg-[#091522] px-3.5 py-3 sm:px-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
            {description?.trim() || "Chưa cung cấp mô tả cho phản ánh này."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
