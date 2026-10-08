import { Router } from 'express';
import { gisController } from '../controllers/gis.controller';
import { asyncHandler } from '@ecoalert/shared';
import serviceAreaRoutes from './service-area.routes';

const router = Router();
router.use('/service-areas',serviceAreaRoutes);

// /api/v1/gis is proxied here as /
router.get('/nearby', asyncHandler(gisController.getNearby));
router.get('/radius', asyncHandler(gisController.getRadius));
router.get('/route', asyncHandler(gisController.getRoute));
router.get('/incidents/heatmap', asyncHandler(gisController.getIncidentHeatmap.bind(gisController)));
router.get('/incidents/nearby', asyncHandler(gisController.getIncidentDrilldown.bind(gisController)));

export default router;
