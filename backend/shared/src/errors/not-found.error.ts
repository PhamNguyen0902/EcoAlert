import { AppError } from './app-error';
import { HTTP_STATUS } from '../constants';

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, HTTP_STATUS.NOT_FOUND);
  }
}
