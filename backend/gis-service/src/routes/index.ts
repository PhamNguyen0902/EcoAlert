import { Router } from 'express';
import { gisController } from '../controllers/gis.controller';
import { asyncHandler, requireVerifiedRoles } from '@ecoalert/shared';
import serviceAreaRoutes from './service-area.routes';

const router = Router();
router.use('/service-areas',serviceAreaRoutes);

// /api/v1/gis is proxied here as /
router.get('/nearby', requireVerifiedRoles(['CITIZEN', 'OFFICER', 'ADMIN']), asyncHandler(gisController.getNearby));
router.get('/radius', requireVerifiedRoles(['CITIZEN', 'OFFICER', 'ADMIN']), asyncHandler(gisController.getRadius));
router.get('/route', requireVerifiedRoles(['CITIZEN', 'OFFICER', 'ADMIN']), asyncHandler(gisController.getRoute));
router.get('/incidents/heatmap', requireVerifiedRoles(['ADMIN']), asyncHandler(gisController.getIncidentHeatmap.bind(gisController)));
router.get('/incidents/nearby', requireVerifiedRoles(['ADMIN']), asyncHandler(gisController.getIncidentDrilldown.bind(gisController)));

export default router;
