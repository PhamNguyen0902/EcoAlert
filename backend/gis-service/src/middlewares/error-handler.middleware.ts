import { Request, Response, NextFunction } from 'express';
import { AppError, HTTP_STATUS, errorResponse, createLogger } from '@ecoalert/shared';

const logger = createLogger('gis-service');

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }
  logger.error('Unhandled Exception:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse('Internal Server Error'));
};
