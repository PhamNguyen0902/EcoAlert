import { AppError } from './app-error';
import { HTTP_STATUS } from '../constants';

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, HTTP_STATUS.BAD_REQUEST);
  }
}
