import { LocateFixed, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CoordinateDisplay } from '@/components/location/CoordinateDisplay';
import type { PickedLocation } from '@/components/location/LocationPickerModal';

interface SelectedLocationCardProps {
  location: PickedLocation | null;
  onChooseOnMap: () => void;
  onUseCurrentLocation: () => void;
  isLocating?: boolean;
  disabled?: boolean;
}

export function SelectedLocationCard({
  location,
  onChooseOnMap,
  onUseCurrentLocation,
  isLocating = false,
  disabled = false,
}: SelectedLocationCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm" aria-labelledby="selected-location-heading">
      <div className="border-b bg-primary/[0.045] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h4 id="selected-location-heading" className="font-semibold">Vị trí đã chọn</h4>
            <p className="text-xs text-muted-foreground">Xác nhận vị trí chính xác nơi sự cố đang xảy ra.</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {location ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-foreground">{location.address}</p>
            <CoordinateDisplay
              latitude={location.latitude}
              longitude={location.longitude}
              className="rounded-lg border bg-muted/35 px-3 py-2.5"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/25 px-4 py-7 text-center">
            <MapPin className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Chưa chọn vị trí sự cố</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Tìm kiếm một địa chỉ, sử dụng vị trí GPS của bạn, hoặc đánh dấu trên bản đồ.</p>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={onChooseOnMap} disabled={disabled}>
            <MapPin className="mr-2 h-4 w-4" />Chọn trên bản đồ
          </Button>
          <Button type="button" variant="outline" onClick={onUseCurrentLocation} disabled={disabled || isLocating}>
            <LocateFixed className="mr-2 h-4 w-4" />{isLocating ? 'Đang tìm vị trí...' : 'Vị trí của tôi'}
          </Button>
        </div>
      </div>
    </section>
  );
}
