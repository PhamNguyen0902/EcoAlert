import { MapPin } from 'lucide-react';
import { CoordinateDisplay } from '@/components/location/CoordinateDisplay';
import { LocationActions } from '@/components/location/LocationActions';
import { hasValidCoordinates } from '@/lib/maps';

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
  const hasCoordinates = hasValidCoordinates(latitude, longitude);
  const addressParts = address?.split(',').map((part) => part.trim()).filter(Boolean) ?? [];
  const hasPartialAddress = addressParts.length < 3;
  const displayedAddress = addressParts.join(', ') || 'Address unavailable';

  return (
    <div className="space-y-4 rounded-xl bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <MapPin className="h-4 w-4" />
        </span>
        <h3 className="font-semibold">Incident Location</h3>
      </div>

      <div className="rounded-lg border bg-background/70 px-3 py-2.5 backdrop-blur-sm">
        {hasPartialAddress ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Near:</p> : null}
        <p className="text-sm leading-6 text-foreground">{displayedAddress}</p>
      </div>

      {hasCoordinates && latitude !== undefined && longitude !== undefined ? (
        <CoordinateDisplay
          latitude={latitude}
          longitude={longitude}
          className="rounded-lg border bg-background/70 px-3 py-2.5 backdrop-blur-sm"
        />
      ) : (
        <p className="text-sm text-muted-foreground">GPS coordinates are unavailable for this report.</p>
      )}

      <LocationActions latitude={latitude} longitude={longitude} />
    </div>
  );
}
