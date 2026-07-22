import { userRepository } from '../repositories/user.repository';
import { UpdateProfileDto, ChangePasswordDto } from '../dtos/user.dto';
import { NotFoundError, BadRequestError, UserRole } from '@ecoalert/shared';
import { hashPassword, comparePassword } from '../utils/password.util';

export class UserService {
  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await userRepository.update(userId, data);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user || !user.password) throw new NotFoundError('User not found');

    const isMatch = await comparePassword(data.oldPassword, user.password);
    if (!isMatch) throw new BadRequestError('Invalid old password');

    const newHashed = await hashPassword(data.newPassword);
    await userRepository.update(userId, { password: newHashed });
  }

  async getUsers(page: number, limit: number, role?: string, search?: string) {
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (role && role !== 'all') {
      filter.role = role.toUpperCase();
    }
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    return userRepository.findPaginated(filter, skip, limit);
  }

  async changeRole(userId: string, targetUserId: string, role: UserRole) {
    const target = await userRepository.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');
    return userRepository.update(targetUserId, { role, updatedBy: userId });
  }

  async toggleStatus(userId: string, targetUserId: string, isActive: boolean) {
    const target = await userRepository.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');
    return userRepository.update(targetUserId, { isActive, updatedBy: userId });
  }

  async softDelete(userId: string, targetUserId: string) {
    const success = await userRepository.softDelete(targetUserId, userId);
    if (!success) throw new NotFoundError('User not found');
  }
}

export const userService = new UserService();
