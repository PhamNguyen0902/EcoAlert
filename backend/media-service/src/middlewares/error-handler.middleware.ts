import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError, HTTP_STATUS, errorResponse, createLogger } from '@ecoalert/shared';

const logger = createLogger('media-service');

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : HTTP_STATUS.BAD_REQUEST;
    res.status(status).json(errorResponse(err.message));
    return;
  }
  logger.error('Unhandled Exception:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse('Internal Server Error'));
};
