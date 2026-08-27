import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface CoordinateDisplayProps {
  latitude: number;
  longitude: number;
  className?: string;
}

export function CoordinateDisplay({ latitude, longitude, className }: CoordinateDisplayProps) {
  const { language } = useLanguage();
  const text = language === 'vi'
    ? { latitude: 'Vĩ độ:', longitude: 'Kinh độ:' }
    : { latitude: 'Latitude:', longitude: 'Longitude:' };

  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm', className)}>
      <dt className="text-muted-foreground">{text.latitude}</dt>
      <dd className="font-mono font-medium tabular-nums">{latitude.toFixed(6)}</dd>
      <dt className="text-muted-foreground">{text.longitude}</dt>
      <dd className="font-mono font-medium tabular-nums">{longitude.toFixed(6)}</dd>
    </dl>
  );
}
