import { useRef, useState } from 'react';
import { FileImage, ImagePlus, Loader2, RotateCcw, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EvidenceUploaderProps {
  file: File | null;
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function EvidenceUploader({ file, previewUrl, onSelect, onRemove, disabled = false, isProcessing = false }: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const selectFile = (nextFile?: File) => {
    if (nextFile) onSelect(nextFile);
  };

  if (file && previewUrl) {
    return (
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid gap-0 sm:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)]">
          <img src={previewUrl} alt={`Evidence preview: ${file.name}`} className="h-52 w-full bg-muted object-cover sm:h-full sm:min-h-64" />
          <div className="flex flex-col p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileImage className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" title={file.name}>{file.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(file.size)} · Ready to submit</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">This image will be uploaded securely when you submit the report.</p>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" />Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />Remove
              </Button>
            </div>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            selectFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <label
      className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/45'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!disabled) selectFile(event.dataTransfer.files?.[0]);
      }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><UploadCloud className="h-6 w-6" aria-hidden="true" /></span>
      <span className="mt-4 text-sm font-semibold">Drag an image here, or click to browse</span>
      <span className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">One evidence image is required. JPG, PNG, or WEBP up to 10 MB.</span>
      <span className="mt-4 inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs font-medium text-foreground"><ImagePlus className="h-3.5 w-3.5" />Choose image</span>
      {isProcessing ? <span className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading evidence…</span> : null}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </label>
  );
}
