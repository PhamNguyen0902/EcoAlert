import { Router } from 'express';
import { gisController } from '../controllers/gis.controller';
import { asyncHandler } from '@ecoalert/shared';

const router = Router();

// /api/v1/gis is proxied here as /
router.get('/nearby', asyncHandler(gisController.getNearby));
router.get('/radius', asyncHandler(gisController.getRadius));
router.get('/incidents/heatmap', asyncHandler(gisController.getIncidentHeatmap.bind(gisController)));
router.get('/incidents/nearby', asyncHandler(gisController.getIncidentDrilldown.bind(gisController)));

export default router;
