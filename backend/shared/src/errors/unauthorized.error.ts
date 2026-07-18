import { AppError } from './app-error';
import { HTTP_STATUS } from '../constants';

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, HTTP_STATUS.UNAUTHORIZED);
  }
}
