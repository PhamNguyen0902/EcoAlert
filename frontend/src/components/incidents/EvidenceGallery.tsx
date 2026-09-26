import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Image as ImageIcon,
  X,
} from "lucide-react";

type EvidenceGalleryProps = {
  title: string;
  description?: string;
  images: string[];
  emptyMessage: string;
  altPrefix?: string;
};

const MAX_VISIBLE_THUMBNAILS = 4;

export function EvidenceGallery({
  title,
  description,
  images,
  emptyMessage,
  altPrefix = "Ảnh minh chứng",
}: EvidenceGalleryProps) {
  const validImages = useMemo(
    () => images.filter((image): image is string => Boolean(image?.trim())),
    [images],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    if (activeIndex >= validImages.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, validImages.length]);

  useEffect(() => {
    if (!isLightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLightboxOpen(false);
        return;
      }

      if (validImages.length <= 1) return;

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) =>
          current === 0 ? validImages.length - 1 : current - 1,
        );
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) =>
          current === validImages.length - 1 ? 0 : current + 1,
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isLightboxOpen, validImages.length]);

  const activeImage = validImages[activeIndex];
  const hiddenImageCount = Math.max(
    validImages.length - MAX_VISIBLE_THUMBNAILS,
    0,
  );

  const goPrevious = () => {
    if (validImages.length <= 1) return;
    setActiveIndex((current) =>
      current === 0 ? validImages.length - 1 : current - 1,
    );
  };

  const goNext = () => {
    if (validImages.length <= 1) return;
    setActiveIndex((current) =>
      current === validImages.length - 1 ? 0 : current + 1,
    );
  };

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0b1727] shadow-[0_18px_60px_rgba(0,0,0,0.14)]"
      aria-label={title}
    >
      <div className="flex flex-col gap-3 border-b border-slate-800/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/20 bg-[#10B981]/[0.08] text-[#10B981]">
            </span>
            <h2 className="truncate text-sm font-semibold text-slate-100 sm:text-[15px]">
              {title}
            </h2>
          </div>

          {description ? (
            <p className="mt-1.5 pl-[42px] text-xs leading-5 text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        {validImages.length > 0 ? (
          <div className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-700/80 bg-[#071321] px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Tổng cộng {validImages.length} tệp đính kèm
          </div>
        ) : null}
      </div>

      {validImages.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-slate-700 bg-[#071321] text-slate-500">
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-medium text-slate-300">{emptyMessage}</p>
          <p className="mt-1 text-xs text-slate-600">
            Chưa có tệp hình ảnh nào được đính kèm với mục này.
          </p>
        </div>
      ) : (
        <div className="p-3 sm:p-4">
          <div className="group relative overflow-hidden rounded-xl border border-slate-800 bg-[#050d17]">
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="block w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#10B981]/70"
              aria-label={`Mở ${altPrefix} ${activeIndex + 1}`}
            >
              <div className="relative aspect-[16/8.6] min-h-[220px] w-full overflow-hidden bg-[#07111d] sm:min-h-[300px]">
                <img
                  key={activeImage}
                  src={activeImage}
                  alt={`${altPrefix} ${activeIndex + 1}`}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.01]"
                  loading={activeIndex === 0 ? "eager" : "lazy"}
                />

                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#02070d]/90 via-[#02070d]/45 to-transparent"
                  aria-hidden="true"
                />

                <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/45 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-200 backdrop-blur-md sm:left-4 sm:top-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,.8)]" />
                  Bằng chứng #{activeIndex + 1}
                </div>

                <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/45 text-slate-100 backdrop-blur-md transition-colors group-hover:bg-black/65 sm:right-4 sm:top-4">
                  <Expand className="h-4 w-4" aria-hidden="true" />
                </span>

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-4 pt-10 sm:px-5 sm:pb-5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {title}
                    </p>
                    <p className="mt-1 truncate text-xs font-medium text-slate-100 sm:text-sm">
                      {altPrefix} {activeIndex + 1} / {validImages.length}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-medium text-slate-300 backdrop-blur-sm">
                    Ảnh gốc
                  </span>
                </div>
              </div>
            </button>

            {validImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={goPrevious}
                  className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white opacity-0 backdrop-blur transition-all hover:bg-black/70 focus:opacity-100 group-hover:opacity-100 sm:flex"
                  aria-label="Ảnh trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white opacity-0 backdrop-blur transition-all hover:bg-black/70 focus:opacity-100 group-hover:opacity-100 sm:flex"
                  aria-label="Ảnh tiếp theo"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {validImages
              .slice(0, MAX_VISIBLE_THUMBNAILS)
              .map((image, index) => {
                const isActive = index === activeIndex;

                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={[
                      "group/thumb relative aspect-[4/2.7] overflow-hidden rounded-lg border bg-[#071321] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/60",
                      isActive
                        ? "border-[#10B981]/70 ring-1 ring-[#10B981]/20"
                        : "border-slate-800 hover:border-slate-600",
                    ].join(" ")}
                    aria-label={`Chọn ${altPrefix} ${index + 1}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    <img
                      src={image}
                      alt=""
                      className={[
                        "h-full w-full object-cover transition duration-200",
                        isActive
                          ? "opacity-100"
                          : "opacity-65 group-hover/thumb:opacity-100",
                      ].join(" ")}
                      loading="lazy"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white/80">
                      #{index + 1}
                    </span>
                  </button>
                );
              })}

            {hiddenImageCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setActiveIndex(MAX_VISIBLE_THUMBNAILS);
                  setIsLightboxOpen(true);
                }}
                className="relative aspect-[4/2.7] overflow-hidden rounded-lg border border-slate-800 bg-[#071321] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/60"
                aria-label={`Xem thêm ${hiddenImageCount} ảnh`}
              >
                <img
                  src={validImages[MAX_VISIBLE_THUMBNAILS]}
                  alt=""
                  className="h-full w-full object-cover opacity-25"
                  loading="lazy"
                />
                <span className="absolute inset-0 flex flex-col items-center justify-center bg-[#02070d]/45 text-center">
                  <span className="text-base font-bold text-slate-100">
                    +{hiddenImageCount}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium text-slate-400">
                    ảnh khác
                  </span>
                </span>
              </button>
            ) : validImages.length < 5 ? (
              <div className="hidden aspect-[4/2.7] rounded-lg border border-dashed border-slate-800/70 bg-[#071321]/35 sm:block" />
            ) : null}
          </div>
        </div>
      )}

      {isLightboxOpen && activeImage ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#02060b]/95 p-3 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh minh chứng"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsLightboxOpen(false);
          }}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white transition hover:bg-black/75 sm:right-6 sm:top-6"
            aria-label="Đóng ảnh"
          >
            <X className="h-5 w-5" />
          </button>

          {validImages.length > 1 ? (
            <button
              type="button"
              onClick={goPrevious}
              className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white transition hover:bg-black/75 sm:left-6"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          <figure className="flex max-h-full max-w-[min(1400px,94vw)] flex-col items-center">
            <img
              src={activeImage}
              alt={`${altPrefix} ${activeIndex + 1}`}
              className="max-h-[84vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <figcaption className="mt-3 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-slate-300">
              {activeIndex + 1} / {validImages.length}
            </figcaption>
          </figure>

          {validImages.length > 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-white transition hover:bg-black/75 sm:right-6"
              aria-label="Ảnh tiếp theo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
