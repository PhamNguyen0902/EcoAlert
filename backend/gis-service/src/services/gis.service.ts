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
        await existing.save();
        return;
      }
      
      const loc = new Location({
        alertId: alertData._id,
        category: alertData.category,
        severity: alertData.severity,
        status: alertData.status,
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
      location: {
        $geoWithin: {
          $centerSphere: [[lng, lat], radiusInKm / 6378.1]
        }
      }
    });
  }
}

export const gisService = new GisService();
