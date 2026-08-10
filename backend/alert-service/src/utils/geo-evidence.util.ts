/** Geographic checks used for operational evidence. GeoJSON coordinates are [longitude, latitude]. */
export const haversineDistanceMeters = (
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB))
    * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const isValidLatitude = (value: number) => Number.isFinite(value) && value >= -90 && value <= 90;
export const isValidLongitude = (value: number) => Number.isFinite(value) && value >= -180 && value <= 180;
