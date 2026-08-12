import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLngTuple } from 'leaflet';
import L from 'leaflet';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Loader2, LocateFixed, MapPin, X } from 'lucide-react';
import { useGeolocation } from '@/features/citizen/hooks/useGeolocation';
import { Button } from '@/components/ui/button';
import { CoordinateDisplay } from '@/components/location/CoordinateDisplay';
import { LocationActions } from '@/components/location/LocationActions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { reverseGeocoder } from '@/services/reverseGeocoder';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface LocationPickerModalProps {
  open: boolean;
  initialPosition: LatLngTuple;
  initialAddress?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (location: PickedLocation) => void;
}

const fallbackAddress = 'Gần tọa độ đã chọn';

const coordinateKey = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

const selectedLocationIcon = L.divIcon({
  className: 'ecoalert-location-marker',
  html: '<span class="ecoalert-location-marker__pulse"></span><span class="ecoalert-location-marker__dot"></span>',
  iconAnchor: [26, 26],
  iconSize: [52, 52],
});

function MapViewport({ position, focusRequest }: { position: LatLngTuple; focusRequest: number }) {
  const map = useMap();
  const previousPosition = useRef<LatLngTuple | null>(null);
  const previousFocusRequest = useRef(focusRequest);

  useEffect(() => {
    const didPositionChange =
      previousPosition.current === null ||
      previousPosition.current[0] !== position[0] ||
      previousPosition.current[1] !== position[1];
    const shouldFocus = previousFocusRequest.current !== focusRequest;

    if (didPositionChange || shouldFocus) {
      map.flyTo(position, Math.max(map.getZoom(), 16), {
        animate: true,
        duration: 0.65,
      });
      previousPosition.current = position;
      previousFocusRequest.current = focusRequest;
    }
  }, [focusRequest, map, position]);

  return null;
}

function MapClickHandler({ onPositionChange }: { onPositionChange: (position: LatLngTuple) => void }) {
  useMapEvents({
    click(event) {
      onPositionChange([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

export function LocationPickerModal({
  open,
  initialPosition,
  initialAddress,
  onOpenChange,
  onConfirm,
}: LocationPickerModalProps) {
  const geolocation = useGeolocation();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const lastRequestedKey = useRef<string | null>(null);
  const hasCenteredOnDeviceLocation = useRef(false);
  const pendingDeviceRecenter = useRef(true);
  const [location, setLocation] = useState<PickedLocation>(() => ({
    latitude: initialPosition[0],
    longitude: initialPosition[1],
    address: initialAddress || fallbackAddress,
  }));
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);

  const requestAddress = useCallback((latitude: number, longitude: number) => {
    const key = coordinateKey(latitude, longitude);

    setLocation((currentLocation) => ({
      latitude,
      longitude,
      address: currentLocation.address || fallbackAddress,
    }));

    if (lastRequestedKey.current === key) {
      return;
    }

    lastRequestedKey.current = key;
    requestId.current += 1;
    const currentRequestId = requestId.current;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setIsReverseGeocoding(true);
    debounceTimer.current = setTimeout(async () => {
      const address = await reverseGeocoder.reverseGeocode(latitude, longitude);
      if (requestId.current !== currentRequestId) {
        return;
      }

      if (!address) {
        lastRequestedKey.current = null;
      }
      setLocation({
        latitude,
        longitude,
        address: address || fallbackAddress,
      });
      setIsReverseGeocoding(false);
    }, 500);
  }, []);

  useEffect(() => {
    if (!open) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      requestId.current += 1;
      setIsReverseGeocoding(false);
      return;
    }

    hasCenteredOnDeviceLocation.current = false;
    pendingDeviceRecenter.current = true;
    lastRequestedKey.current = null;
    setLocation({
      latitude: initialPosition[0],
      longitude: initialPosition[1],
      address: initialAddress || fallbackAddress,
    });
    requestAddress(initialPosition[0], initialPosition[1]);
  }, [initialAddress, initialPosition, open, requestAddress]);

  useEffect(() => {
    if (
      !open ||
      geolocation.loading ||
      geolocation.error ||
      geolocation.latitude === null ||
      geolocation.longitude === null ||
      (!pendingDeviceRecenter.current && hasCenteredOnDeviceLocation.current)
    ) {
      return;
    }

    hasCenteredOnDeviceLocation.current = true;
    pendingDeviceRecenter.current = false;
    requestAddress(geolocation.latitude, geolocation.longitude);
    setFocusRequest((currentRequest) => currentRequest + 1);
  }, [
    geolocation.error,
    geolocation.latitude,
    geolocation.loading,
    geolocation.longitude,
    open,
    requestAddress,
  ]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      requestId.current += 1;
    };
  }, []);

  const handlePositionChange = useCallback(
    (position: LatLngTuple) => {
      requestAddress(position[0], position[1]);
    },
    [requestAddress],
  );

  const handleUseMyLocation = () => {
    const { error, latitude, loading, longitude } = geolocation;

    if (!loading && !error && latitude !== null && longitude !== null) {
      requestAddress(latitude, longitude);
      setFocusRequest((currentRequest) => currentRequest + 1);
      return;
    }

    pendingDeviceRecenter.current = true;
    geolocation.refresh();
  };

  const markerPosition: LatLngTuple = [location.latitude, location.longitude];
  const addressParts = location.address.split(',').map((part) => part.trim()).filter(Boolean);
  const isApproximateAddress = location.address === fallbackAddress || addressParts.length < 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-slate-950/75 backdrop-blur-sm"
        className="!inset-0 !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !rounded-none !border-0 !p-0 sm:!inset-auto sm:!left-1/2 sm:!top-1/2 sm:!h-[90vh] sm:!w-[90vw] sm:!max-w-[1400px] sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-3xl lg:!h-[95vh] lg:!w-[95vw]"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Chọn vị trí sự cố</DialogTitle>
          <DialogDescription>Nhấn vào bản đồ, kéo điểm đánh dấu, hoặc sử dụng vị trí GPS hiện tại của bạn.</DialogDescription>
        </DialogHeader>

        <div className="relative h-full w-full overflow-hidden bg-muted">
          <MapContainer center={markerPosition} zoom={16} zoomControl={false} className="ecoalert-map-modal h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="topright" />
            <MapViewport position={markerPosition} focusRequest={focusRequest} />
            <MapClickHandler onPositionChange={handlePositionChange} />
            <CircleMarker
              center={markerPosition}
              radius={26}
              pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.1, weight: 1.5 }}
            />
            <Marker
              position={markerPosition}
              icon={selectedLocationIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const { lat, lng } = marker.getLatLng();
                  handlePositionChange([lat, lng]);
                },
              }}
            >
              <Popup className="ecoalert-map-popup">
                <p className="font-semibold">Vị trí sự cố đã chọn</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
              </Popup>
            </Marker>
          </MapContainer>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] h-8 w-8 -translate-x-1/2 -translate-y-1/2 opacity-70">
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-slate-950/80 shadow-sm" />
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-950/80 shadow-sm" />
            <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute left-4 top-4 z-[500] rounded-xl bg-background/95 shadow-lg backdrop-blur"
            onClick={() => onOpenChange(false)}
            aria-label="Hủy chọn vị trí"
          >
            <X className="h-5 w-5" />
          </Button>

          <div className="absolute right-4 top-28 z-[500] flex flex-col items-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl bg-background/95 shadow-lg backdrop-blur"
              onClick={handleUseMyLocation}
              disabled={geolocation.loading}
            >
              {geolocation.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
              {geolocation.loading ? 'Đang tìm...' : 'Vị trí của tôi'}
            </Button>
            <LocationActions
              latitude={location.latitude}
              longitude={location.longitude}
              presentation="compact"
              showNavigation={false}
            />
          </div>

          <div className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-xl space-y-3 sm:bottom-5">
            <div className="rounded-2xl border border-white/25 bg-background/90 p-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <MapPin className="h-4 w-4" />
                </span>
                Vị trí đã chọn
              </div>

              <div className="mt-3" aria-live="polite">
                {isReverseGeocoding ? (
                  <div className="flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Đang tìm địa chỉ...
                  </div>
                ) : (
                  <div>
                    {isApproximateAddress ? (
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gần:</p>
                    ) : null}
                    <p className="text-sm font-medium leading-5">{location.address}</p>
                  </div>
                )}
              </div>

              <CoordinateDisplay
                latitude={location.latitude}
                longitude={location.longitude}
                className="mt-4 rounded-lg border bg-muted/30 px-3 py-2"
              />

              {geolocation.accuracy !== null ? (
                <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs">
                  <p className="font-medium">Độ chính xác GPS: ±{Math.round(geolocation.accuracy)}m</p>
                  {geolocation.accuracy > 30 ? (
                    <p className="mt-1 text-amber-700 dark:text-amber-400">
                      Tín hiệu GPS yếu. Vui lòng di chuyển ra ngoài để có độ chính xác tốt hơn.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="bg-background/95 backdrop-blur" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="button" className="shadow-lg" onClick={() => onConfirm(location)}>
                <Check className="mr-2 h-4 w-4" />
                Xác nhận vị trí
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
