import toast from 'react-hot-toast';

export const hasValidCoordinates = (latitude: unknown, longitude: unknown):
  latitude is number =>
  typeof latitude === 'number' &&
  typeof longitude === 'number' &&
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export const googleMapsUrl = (latitude: number, longitude: number): string =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;

export const googleMapsDirectionsUrl = (latitude: number, longitude: number): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

type GoogleMapsAction = 'location' | 'navigation';
type ValidCoordinates = readonly [latitude: number, longitude: number];

const getLang = (): 'en' | 'vi' => {
  const lang = localStorage.getItem('ecoalert_lang');
  return lang === 'en' ? 'en' : 'vi';
};

const locationUnavailable = (): false => {
  toast.error(getLang() === 'en' ? 'Location is unavailable.' : 'Không thể lấy thông tin vị trí.');
  return false;
};

const getValidCoordinates = (latitude: unknown, longitude: unknown): ValidCoordinates | null => {
  if (!hasValidCoordinates(latitude, longitude) || typeof longitude !== 'number') {
    return null;
  }

  return [latitude, longitude];
};

export const formatCoordinates = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(6)},${longitude.toFixed(6)}`;

export const openGoogleMaps = (
  latitude: unknown,
  longitude: unknown,
  action: GoogleMapsAction = 'location',
): boolean => {
  const coordinates = getValidCoordinates(latitude, longitude);
  if (!coordinates) {
    return locationUnavailable();
  }
  const [validLatitude, validLongitude] = coordinates;

  const url = action === 'navigation'
    ? googleMapsDirectionsUrl(validLatitude, validLongitude)
    : googleMapsUrl(validLatitude, validLongitude);

  try {
    const newTab = window.open(url, '_blank', 'noopener,noreferrer');

    if (!newTab) {
      window.location.href = url;
    }

    return true;
  } catch {
    try {
      window.location.href = url;
      return true;
    } catch {
      toast.error(getLang() === 'en' ? 'Unable to open Google Maps. Please try again.' : 'Không thể mở Google Maps. Vui lòng thử lại.');
      return false;
    }
  }
};

export const startGoogleMapsNavigation = (latitude: unknown, longitude: unknown): boolean =>
  openGoogleMaps(latitude, longitude, 'navigation');

export const copyCoordinates = async (latitude: unknown, longitude: unknown): Promise<boolean> => {
  const validCoordinates = getValidCoordinates(latitude, longitude);
  if (!validCoordinates) {
    return locationUnavailable();
  }
  const [validLatitude, validLongitude] = validCoordinates;

  const coordinates = formatCoordinates(validLatitude, validLongitude);

  try {
    await navigator.clipboard.writeText(coordinates);
    toast.success(getLang() === 'en' ? 'Coordinates copied.' : 'Đã sao chép tọa độ.');
    return true;
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = coordinates;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      const didCopy = document.execCommand('copy');
      if (didCopy) {
        toast.success(getLang() === 'en' ? 'Coordinates copied.' : 'Đã sao chép tọa độ.');
        return true;
      }

      toast.error(getLang() === 'en' ? 'Unable to copy coordinates. Please try again.' : 'Không thể sao chép tọa độ. Vui lòng thử lại.');
      return false;
    } catch {
      toast.error(getLang() === 'en' ? 'Unable to copy coordinates. Please try again.' : 'Không thể sao chép tọa độ. Vui lòng thử lại.');
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};
