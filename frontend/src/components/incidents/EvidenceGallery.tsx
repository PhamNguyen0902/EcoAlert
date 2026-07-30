import { useState } from 'react';
import { Image as ImageIcon, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EvidenceGalleryProps {
  title: string;
  description?: string;
  images?: string[];
  emptyMessage: string;
  altPrefix: string;
}

export function EvidenceGallery({ title, description, images = [], emptyMessage, altPrefix }: EvidenceGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedImage = selectedIndex === null ? null : images[selectedIndex];

  return (
    <section aria-labelledby={`${altPrefix}-evidence-heading`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id={`${altPrefix}-evidence-heading`} className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{images.length} {images.length === 1 ? 'image' : 'images'}</span>
      </div>

      {images.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Open ${altPrefix} image ${index + 1}`}
            >
              <img src={url} alt={`${altPrefix} image ${index + 1}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" />
              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 className="h-5 w-5 text-white" aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-5 text-center">
          <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}

      <Dialog open={selectedImage !== null} onOpenChange={(open) => { if (!open) setSelectedIndex(null); }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0" aria-describedby={undefined}>
          <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle><DialogDescription>Expanded evidence image.</DialogDescription></DialogHeader>
          {selectedImage ? <img src={selectedImage} alt={`${altPrefix} image ${(selectedIndex ?? 0) + 1} expanded`} className="max-h-[85vh] w-full bg-black object-contain" /> : null}
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="icon" className="absolute right-3 top-3 bg-background/90 shadow-sm" aria-label="Close evidence image"><X className="h-4 w-4" /></Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </section>
  );
}
