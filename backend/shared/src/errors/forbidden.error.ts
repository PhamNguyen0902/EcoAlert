import { AppError } from './app-error';
import { HTTP_STATUS } from '../constants';

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access') {
    super(message, HTTP_STATUS.FORBIDDEN);
  }
}
