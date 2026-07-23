import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, HTTP_STATUS, errorResponse, createLogger } from '@ecoalert/shared';

const logger = createLogger('user-service');

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    if (err instanceof ValidationError) {
      res.status(err.statusCode).json(errorResponse(err.message, err.errors));
      return;
    }
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  // Handle Mongoose duplicate key error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'Email';
    res.status(HTTP_STATUS.CONFLICT).json(errorResponse(`${field} is already in use`));
    return;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message);
    res.status(HTTP_STATUS.BAD_REQUEST).json(errorResponse(messages.join(', ') || 'Validation error'));
    return;
  }

  logger.error('Unhandled Exception:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(errorResponse(err.message || 'Internal Server Error'));
};
