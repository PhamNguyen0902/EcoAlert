import { useRef, useState } from "react";
import { FileImage, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EvidenceUploaderProps {
  files: File[];
  previewUrls: string[];
  onSelect: (files: File[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

const formatFileSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Evidence is selected only here; upload and automatic Vision processing happen on submit. */
export function EvidenceUploader({ files, previewUrls, onSelect, onRemove, disabled = false, isProcessing = false }: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const addFiles = (next?: FileList | File[]) => next && onSelect(Array.from(next));

  return (
    <div className="space-y-4">
      <label
        className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:border-primary/50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => { event.preventDefault(); setIsDragging(false); if (!disabled) addFiles(event.dataTransfer.files); }}
      >
        <UploadCloud className="h-7 w-7 text-primary" />
        <span className="mt-3 text-sm font-semibold">Kéo ảnh vào đây hoặc nhấp để chọn</span>
        <span className="mt-2 text-xs text-muted-foreground">Tối đa 6 ảnh · JPG, PNG hoặc WEBP · mỗi ảnh tối đa 10 MB.</span>
        <span className="mt-4 inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium"><ImagePlus className="h-3.5 w-3.5" />Thêm ảnh</span>
        {isProcessing ? <span className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang xử lý báo cáo…</span> : null}
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled} onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
      </label>
      {files.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="overflow-hidden rounded-xl border bg-card">
          <img src={previewUrls[index]} alt={`Minh chứng ${index + 1}`} className="h-36 w-full bg-muted object-cover" />
          <div className="flex items-center gap-2 p-3"><FileImage className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">Ảnh {index + 1}: {file.name}</p><p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} disabled={disabled} aria-label={`Xóa ảnh ${index + 1}`}><Trash2 className="h-4 w-4" /></Button></div>
        </div>)}
      </div> : null}
    </div>
  );
}
