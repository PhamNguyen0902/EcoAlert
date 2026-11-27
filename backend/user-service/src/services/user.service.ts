import { userRepository } from '../repositories/user.repository';
import { UpdateProfileDto, ChangePasswordDto, CreateUserDto } from '../dtos/user.dto';
import { NotFoundError, BadRequestError, UserRole } from '@ecoalert/shared';
import { hashPassword, comparePassword } from '../utils/password.util';
import { tokenService } from './token.service';

export class UserService {
  // Tạo người dùng mới (dành cho Admin)
  async createUser(data: CreateUserDto) {
    const existing = await userRepository.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new BadRequestError('Email already registered');

    const hashedPassword = await hashPassword(data.password);
    const user = await userRepository.create({
      email: data.email.toLowerCase(),
      password: hashedPassword,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role || UserRole.CITIZEN,
      isActive: true,
      isVerified: true,
    });
    return user;
  }

  // Lấy thông tin hồ sơ người dùng
  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  // Cập nhật thông tin hồ sơ người dùng
  async updateProfile(userId: string, data: UpdateProfileDto) {
    const updateData: {
      fullName?: string;
      phone?: string;
      avatar?: string;
      pushToken?: string;
    } = {};

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.pushToken !== undefined) updateData.pushToken = data.pushToken;

    if ((data.firstName || data.lastName) && !data.fullName) {
      const user = await userRepository.findById(userId);
      const parts = (user?.fullName || '').trim().split(/\s+/);
      const firstName = data.firstName !== undefined ? data.firstName : (parts[0] || '');
      const lastName = data.lastName !== undefined ? data.lastName : (parts.slice(1).join(' ') || '');
      updateData.fullName = `${firstName} ${lastName}`.trim();
    }
    const user = await userRepository.update(userId, updateData);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  // Thay đổi mật khẩu người dùng
  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user || !user.password) throw new NotFoundError('User not found');

    const isMatch = await comparePassword(data.oldPassword, user.password);
    if (!isMatch) throw new BadRequestError('Invalid old password');

    const newHashed = await hashPassword(data.newPassword);
    await userRepository.update(userId, { password: newHashed });
    await tokenService.revokeAllUserTokens(userId);
  }
  // Lấy danh sách người dùng với phân trang, lọc theo vai trò và tìm kiếm
  async getUsers(page: number, limit: number, role?: string, search?: string, isDeleted?: string) {
    const safePage = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    const safeLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 10));
    const skip = (safePage - 1) * safeLimit;
    const filter: any = {};
    if (typeof role === 'string' && role && role !== 'all') {
      filter.role = role.toUpperCase();
    }
    if (isDeleted === 'true') {
      filter.isDeleted = true;
      filter.includeDeleted = true;
    } else if (isDeleted === 'false') {
      filter.isDeleted = false;
    }
    if (typeof search === 'string' && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { fullName: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } }
      ];
    }
    return userRepository.findPaginated(filter, skip, safeLimit);
  }
  // Thay đổi vai trò người dùng
  async changeRole(userId: string, targetUserId: string, role: string) {
    if (userId === targetUserId) {
      throw new BadRequestError('Cannot perform this action on your own account');
    }
    const target = await userRepository.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');
    const newRole = (role || '').toUpperCase();
    const updated = await userRepository.update(targetUserId, { role: newRole as any, updatedBy: userId });
    await tokenService.revokeAllUserTokens(targetUserId);
    return updated;
  }

  // Bật/tắt trạng thái hoạt động của người dùng
  async toggleStatus(userId: string, targetUserId: string, isActive: boolean) {
    if (userId === targetUserId) {
      throw new BadRequestError('Cannot perform this action on your own account');
    }
    const target = await userRepository.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');
    const updated = await userRepository.update(targetUserId, { isActive, updatedBy: userId });
    if (!isActive) {
      await tokenService.revokeAllUserTokens(targetUserId);
    }
    return updated;
  }

  // Xóa người dùng
  async deleteUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestError('Cannot perform this action on your own account');
    }
    const target = await userRepository.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');
    const success = await userRepository.delete(targetUserId);
    if (!success) throw new NotFoundError('User not found');
    await tokenService.revokeAllUserTokens(targetUserId);
    return target;
  }
  // Xóa mềm người dùng (đánh dấu là đã xóa)
  async softDelete(userId: string, targetUserId: string) {
    const target = await userRepository.findById(targetUserId);
    if (!target) throw new NotFoundError('User not found');
    const updated = await userRepository.update(targetUserId, { isDeleted: true, updatedBy: userId });
    await tokenService.revokeAllUserTokens(targetUserId);
    return updated;
  }
}

export const userService = new UserService();
