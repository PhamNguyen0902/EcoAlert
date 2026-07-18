import { UserRole } from '../enums';

export interface IUserPayload {
  userId: string;
  email: string;
  role: UserRole;
}
