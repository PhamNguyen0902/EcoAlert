import { Location } from '../models/location.model';
import { createLogger } from '@ecoalert/shared';

const logger = createLogger('gis-service');

export class GisService {
  async saveLocation(alertData: any) {
    try {
      const existing = await Location.findOne({ alertId: alertData._id });
      if (existing) {
        // update
        existing.status = alertData.status;
        existing.category = alertData.category;
        existing.severity = alertData.severity;
        existing.title = alertData.title;
        existing.address = alertData.address;
        existing.isDeleted = Boolean(alertData.isDeleted || alertData.status === 'deleted');
        if (alertData.location?.type === 'Point' && Array.isArray(alertData.location.coordinates)) {
          existing.location = alertData.location;
        }
        await existing.save();
        return;
      }
      
      const loc = new Location({
        alertId: alertData._id,
        category: alertData.category,
        severity: alertData.severity,
        status: alertData.status,
        title: alertData.title,
        address: alertData.address,
        isDeleted: Boolean(alertData.isDeleted || alertData.status === 'deleted'),
        location: alertData.location,
      });
      await loc.save();
      logger.info(`Saved location for alert ${alertData._id}`);
    } catch (error) {
      logger.error('Failed to save location', error);
    }
  }

  async getNearby(lng: number, lat: number, maxDistanceInMeters: number = 5000) {
    return Location.find({
      isDeleted: { $ne: true },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: maxDistanceInMeters
        }
      }
    });
  }
  
  async getRadius(lng: number, lat: number, radiusInKm: number = 5) {
    // MongoDB $geoWithin uses radians if using centerSphere. 1 rad = 6378.1 km
    return Location.find({
      isDeleted: { $ne: true },
      location: {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusInKm / 6378.1]
        }
      }
    });
  }

  async getHeatmap(filters: {
    from?: Date;
    to?: Date;
    category?: string;
    severity?: string;
    status?: string;
  }) {
    const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (filters.from || filters.to) {
      filter.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }
    if (filters.category) filter.category = normalizedCodeRegex(filters.category);
    if (filters.severity) filter.severity = severityRegex(filters.severity);
    const statusFilter = buildStatusFilter(filters.status);
    if (statusFilter) filter.status = statusFilter;

    const locations = await Location.find(filter)
      .select('alertId title address category severity status location createdAt')
      .lean();
    const mappableLocations = locations.flatMap((location) => {
      const [lng, lat] = location.location?.coordinates || [];
      if (!isValidCoordinate(lat, lng)) return [];
      return [{ location, lat, lng }];
    });
    const points = mappableLocations.map(({ location, lat, lng }) => {
      const severity = normalizeIncidentDensitySeverity(location.severity);
      return {
        lat,
        lng,
        weight: isOpenStatus(location.status) ? 1.25 : 1,
        incidentId: location.alertId,
        title: location.title,
        address: location.address,
        category: normalizeIncidentDensityCategory(location.category),
        severity,
        status: normalizeIncidentDensityStatus(location.status),
        createdAt: location.createdAt,
      };
    });
    return { points, summary: summarizeIncidentLocations(mappableLocations.map(({ location }) => location)) };
  }

  async getHeatmapDrilldown(lng: number, lat: number, radiusMeters: number, filters: {
    from?: Date;
    to?: Date;
    category?: string;
    severity?: string;
    status?: string;
  }) {
    const query: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (filters.from || filters.to) query.createdAt = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) };
    if (filters.category) query.category = normalizedCodeRegex(filters.category);
    if (filters.severity) query.severity = severityRegex(filters.severity);
    const statusFilter = buildStatusFilter(filters.status);
    if (statusFilter) query.status = statusFilter;
    const locations = await Location.aggregate<{
      alertId: string; title?: string; address?: string; category: string; severity: string; status: string; location: { coordinates: [number, number] }; createdAt?: Date; distanceMeters: number;
    }>([
      { $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, distanceField: 'distanceMeters', maxDistance: radiusMeters, spherical: true, query } },
      { $limit: 50 },
      { $project: { alertId: 1, title: 1, address: 1, category: 1, severity: 1, status: 1, location: 1, createdAt: 1, distanceMeters: 1 } },
    ]);
    return {
      center: { lat, lng },
      radiusMeters,
      summary: summarizeIncidentLocations(locations),
      incidents: locations,
    };
  }
}

const OPEN_STATUSES = new Set(['pending', 'ai_analyzing', 'verified', 'assigned', 'in_progress']);
const isOpenStatus = (status?: string) => OPEN_STATUSES.has((status || '').toLowerCase());
const isValidCoordinate = (lat: unknown, lng: unknown) => typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizeIncidentDensityCategory = (value?: string | null) =>
  typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s_-]+/g, '_') || 'unclassified'
    : 'unclassified';
export const normalizeIncidentDensitySeverity = (value?: string | null) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'normal') return 'medium';
  return ['low', 'medium', 'high', 'critical'].includes(normalized) ? normalized : null;
};
const normalizeIncidentDensityStatus = (value?: string | null) =>
  typeof value === 'string' ? value.trim().toLowerCase() : 'pending';
const normalizedCodeRegex = (value: string) => {
  const normalized = normalizeIncidentDensityCategory(value);
  return new RegExp(`^${escapeRegex(normalized).replace(/_/g, '[ _-]+')}$`, 'i');
};
const severityRegex = (value: string) => {
  const normalized = normalizeIncidentDensitySeverity(value);
  return normalized === 'medium'
    ? /^(medium|normal)$/i
    : new RegExp(`^${escapeRegex(normalized || value)}$`, 'i');
};
const buildStatusFilter = (status?: string) => {
  if (!status || status === 'all') return undefined;
  if (status === 'active') return { $in: [...OPEN_STATUSES].map((value) => new RegExp(`^${value}$`, 'i')) };
  return new RegExp(`^${escapeRegex(status)}$`, 'i');
};
export const summarizeIncidentLocations = (locations: Array<{ status?: string; category?: string; severity?: string }>) => {
  const statusCounts = { total: locations.length, open: 0, resolved: 0, closed: 0 };
  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const location of locations) {
    const status = (location.status || '').toLowerCase();
    if (isOpenStatus(status)) statusCounts.open += 1;
    if (status === 'resolved') statusCounts.resolved += 1;
    if (status === 'closed') statusCounts.closed += 1;
    const category = normalizeIncidentDensityCategory(location.category);
    const severity = normalizeIncidentDensitySeverity(location.severity) || 'unavailable';
    byCategory[category] = (byCategory[category] || 0) + 1;
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }
  return { ...statusCounts, byCategory, bySeverity };
};

export const gisService = new GisService();
