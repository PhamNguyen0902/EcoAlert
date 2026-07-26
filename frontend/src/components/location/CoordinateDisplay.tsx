import { cn } from '@/lib/utils';

interface CoordinateDisplayProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export function CoordinateDisplay({ latitude, longitude, className }: CoordinateDisplayProps) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm', className)}>
      <dt className="text-muted-foreground">Latitude:</dt>
      <dd className="font-mono font-medium tabular-nums">{latitude.toFixed(6)}</dd>
      <dt className="text-muted-foreground">Longitude:</dt>
      <dd className="font-mono font-medium tabular-nums">{longitude.toFixed(6)}</dd>
    </dl>
  );
}
