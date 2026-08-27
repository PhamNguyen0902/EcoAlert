import { MapPin } from 'lucide-react';
import { CoordinateDisplay } from '@/components/location/CoordinateDisplay';
import { LocationActions } from '@/components/location/LocationActions';
import { hasValidCoordinates } from '@/lib/maps';
import { useLanguage } from '@/contexts/LanguageContext';

interface IncidentLocationDetailsProps {
  address?: string;
  latitude?: number;
  longitude?: number;
}

export function IncidentLocationDetails({
  address,
  latitude,
  longitude,
}: IncidentLocationDetailsProps) {
  const { language } = useLanguage();
  const text = language === 'vi'
    ? { title: 'Vị trí sự cố', near: 'Gần:', unavailable: 'Chưa có địa chỉ', noCoordinates: 'Báo cáo này không có tọa độ GPS.' }
    : { title: 'Incident location', near: 'Near:', unavailable: 'Address unavailable', noCoordinates: 'GPS coordinates are unavailable for this report.' };
  const hasCoordinates = hasValidCoordinates(latitude, longitude);
  const addressParts = address?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
  const hasPartialAddress = addressParts.length < 3;
  const displayedAddress = addressParts.join(', ') || text.unavailable;

  return (
    <div className="space-y-4 rounded-xl bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <MapPin className="h-4 w-4" />
        </span>
        <h3 className="font-semibold">{text.title}</h3>
      </div>

      <div className="rounded-lg border bg-background/70 px-3 py-2.5 backdrop-blur-sm">
        {hasPartialAddress ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{text.near}</p> : null}
        <p className="text-sm leading-6 text-foreground">{displayedAddress}</p>
      </div>

      {hasCoordinates && latitude !== undefined && longitude !== undefined ? (
        <CoordinateDisplay
          latitude={latitude}
          longitude={longitude}
          className="rounded-lg border bg-background/70 px-3 py-2.5 backdrop-blur-sm"
        />
      ) : (
        <p className="text-sm text-muted-foreground">{text.noCoordinates}</p>
      )}

      <LocationActions latitude={latitude} longitude={longitude} />
    </div>
  );
}
