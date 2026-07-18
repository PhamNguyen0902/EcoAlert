import { AppError } from './app-error';
import { HTTP_STATUS } from '../constants';

export class ValidationError extends AppError {
  public readonly errors: string[];

  constructor(message = 'Validation Error', errors: string[] = []) {
    super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    this.errors = errors;
  }
}
