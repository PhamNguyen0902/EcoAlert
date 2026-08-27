import { Request, Response } from 'express';
import { gisService } from '../services/gis.service';
import { BadRequestError, ForbiddenError, successResponse } from '@ecoalert/shared';

export class GisController {
  private requireAdmin(req: Request) {
    if ((req.headers['x-user-role'] as string | undefined)?.toUpperCase() !== 'ADMIN') {
      throw new ForbiddenError('Only Admins can access operational incident density data');
    }
  }

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

  async getIncidentHeatmap(req: Request, res: Response) {
    this.requireAdmin(req);
    const filters = parseIncidentFilters(req);
    const result = await gisService.getHeatmap(filters);
    res.status(200).json(successResponse(result));
  }

  async getIncidentDrilldown(req: Request, res: Response) {
    this.requireAdmin(req);
    const coordinates = parseCoordinates(req);
    const radius = Number(req.query.radius || 500);
    if (!coordinates || !Number.isFinite(radius) || radius <= 0 || radius > 20_000) {
      return res.status(400).json({ success: false, message: 'Valid latitude, longitude, and radius up to 20000 meters are required' });
    }
    const result = await gisService.getHeatmapDrilldown(coordinates.lng, coordinates.lat, radius, parseIncidentFilters(req));
    res.status(200).json(successResponse(result));
  }
}

const parseCoordinates = (
  req: Request,
): { lat: number; lng: number } | null => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
    ? { lat, lng }
    : null;
};

export const gisController = new GisController();

const parseIncidentFilters = (req: Request) => {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (req.query.from && !from) throw new BadRequestError('Invalid from date');
  if (req.query.to && !to) throw new BadRequestError('Invalid to date');
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(typeof req.query.category === 'string' && req.query.category !== 'all' ? { category: req.query.category } : {}),
    ...(typeof req.query.severity === 'string' && req.query.severity !== 'all' ? { severity: req.query.severity } : {}),
    ...(typeof req.query.status === 'string' && req.query.status !== 'all' ? { status: req.query.status } : {}),
  };
};

const parseDate = (value: unknown): Date | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
