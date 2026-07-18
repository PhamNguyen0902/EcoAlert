import { AppError } from './app-error';
import { HTTP_STATUS } from '../constants';

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, HTTP_STATUS.CONFLICT);
  }
}
