import { LocateFixed, MapPin, ShieldCheck } from 'lucide-react';
import { MapContainer, Marker } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { EcoAlertBaseMap } from '@/components/location/EcoAlertBaseMap';
import { redMapMarkerIcon } from '@/lib/red-map-marker';
import 'leaflet/dist/leaflet.css';

interface SelectedLocationCardProps {
  location: { latitude: number; longitude: number; address: string } | null;
  onUseCurrentLocation: () => void;
  isLocating?: boolean;
  disabled?: boolean;
}

// hiển thị thẻ vị trí đã chọn, cho phép người dùng xác nhận vị trí sự cố môi trường.
export function SelectedLocationCard({
  location,
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
            <h4 id="selected-location-heading" className="font-semibold">Vị trí hiện tại</h4>
            <p className="text-xs text-muted-foreground">Chỉ lấy vị trí bạn đang đứng sau khi bạn cho phép.</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {location ? (
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
            <p className="text-sm leading-6 text-foreground">{location.address}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Vị trí được xác nhận từ thiết bị của bạn.
            </div>
            <div className="relative overflow-hidden rounded-lg border bg-muted" aria-label="Bản đồ chỉ xem vị trí hiện tại">
              <div className="pointer-events-none h-48 w-full">
                <MapContainer
                  key={`${location.latitude}-${location.longitude}`}
                  center={[location.latitude, location.longitude]}
                  zoom={16}
                  className="h-full w-full"
                  dragging={false}
                  doubleClickZoom={false}
                  scrollWheelZoom={false}
                  touchZoom={false}
                  keyboard={false}
                  zoomControl={false}
                  attributionControl={false}
                >
                  <EcoAlertBaseMap />
                  <Marker
                    position={[location.latitude, location.longitude]}
                    icon={redMapMarkerIcon}
                  />
                </MapContainer>
              </div>
              <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-slate-950/75 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur">
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Chỉ xem vị trí hiện tại
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed bg-muted/25 px-4 py-7 text-center">
            <MapPin className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">Chưa xác nhận vị trí hiện tại</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">EcoAlert chỉ dùng GPS của thiết bị khi bạn chủ động cho phép; không hỗ trợ tìm kiếm hay chọn điểm trên bản đồ.</p>
          </div>
        )}

        <div className="mt-4">
          <Button type="button" className="w-full" onClick={onUseCurrentLocation} disabled={disabled || isLocating}>
            <LocateFixed className="mr-2 h-4 w-4" />{isLocating ? 'Đang xác nhận vị trí...' : location ? 'Làm mới vị trí hiện tại' : 'Dùng vị trí hiện tại'}
          </Button>
        </div>
      </div>
    </section>
  );
}
