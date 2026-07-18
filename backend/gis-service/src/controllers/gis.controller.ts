import { Request, Response } from 'express';
import { gisService } from '../services/gis.service';
import { successResponse } from '@ecoalert/shared';

export class GisController {
  async getNearby(req: Request, res: Response) {
    const lng = parseFloat(req.query.lng as string);
    const lat = parseFloat(req.query.lat as string);
    const maxDist = parseInt(req.query.maxDistance as string) || 5000;
    
    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }
    
    const results = await gisService.getNearby(lng, lat, maxDist);
    res.status(200).json(successResponse(results));
  }

  async getRadius(req: Request, res: Response) {
    const lng = parseFloat(req.query.lng as string);
    const lat = parseFloat(req.query.lat as string);
    const radius = parseFloat(req.query.radius as string) || 5;
    
    if (isNaN(lng) || isNaN(lat)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }
    
    const results = await gisService.getRadius(lng, lat, radius);
    res.status(200).json(successResponse(results));
  }
}

export const gisController = new GisController();
