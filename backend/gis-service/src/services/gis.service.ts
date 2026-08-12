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
    if (filters.category) filter.category = new RegExp(`^${escapeRegex(filters.category)}$`, 'i');
    if (filters.severity) filter.severity = new RegExp(`^${escapeRegex(filters.severity)}$`, 'i');
    const statusFilter = buildStatusFilter(filters.status);
    if (statusFilter) filter.status = statusFilter;

    const locations = await Location.find(filter)
      .select('alertId title address category severity status location createdAt')
      .lean();
    const points = locations.flatMap((location) => {
      const [lng, lat] = location.location?.coordinates || [];
      if (!isValidCoordinate(lat, lng)) return [];
      return [{
        lat,
        lng,
        weight: isOpenStatus(location.status) ? 1.25 : 1,
        incidentId: location.alertId,
      }];
    });
    return { points, summary: summarizeIncidentLocations(locations) };
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
    if (filters.category) query.category = new RegExp(`^${escapeRegex(filters.category)}$`, 'i');
    if (filters.severity) query.severity = new RegExp(`^${escapeRegex(filters.severity)}$`, 'i');
    const statusFilter = buildStatusFilter(filters.status);
    if (statusFilter) query.status = statusFilter;
    const locations = await Location.aggregate<{
      alertId: string; title?: string; address?: string; category: string; severity: string; status: string; location: { coordinates: [number, number] }; distanceMeters: number;
    }>([
      { $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, distanceField: 'distanceMeters', maxDistance: radiusMeters, spherical: true, query } },
      { $limit: 50 },
      { $project: { alertId: 1, title: 1, address: 1, category: 1, severity: 1, status: 1, location: 1, distanceMeters: 1 } },
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
    if (location.category) byCategory[location.category] = (byCategory[location.category] || 0) + 1;
    if (location.severity) bySeverity[location.severity] = (bySeverity[location.severity] || 0) + 1;
  }
  return { ...statusCounts, byCategory, bySeverity };
};

export const gisService = new GisService();
