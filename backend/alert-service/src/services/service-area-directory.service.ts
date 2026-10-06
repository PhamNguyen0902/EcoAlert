import { internalServiceRequest, type AreaMatchResult } from "@ecoalert/shared";
import { envConfig } from "../config/env.config";
export const serviceAreaDirectory = {
  match: (longitude: number, latitude: number) =>
    internalServiceRequest<AreaMatchResult>(
      envConfig.gisServiceUrl,
      "/service-areas/internal/match",
      "alert-service",
      { longitude, latitude },
    ),
};
