import { User, IUser } from '../models/user.model';
import { IBaseRepository } from '@ecoalert/shared';
import { FilterQuery } from 'mongoose';

export class UserRepository implements IBaseRepository<IUser> {
  async create(data: Partial<IUser>): Promise<IUser> {
    const user = new User(data);
    return user.save();
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  async findByIdWithPassword(id: string): Promise<IUser | null> {
    return User.findById(id).select('+password');
  }

  async findOne(filter: FilterQuery<IUser>): Promise<IUser | null> {
    return User.findOne(filter);
  }

  async findOneWithPassword(filter: FilterQuery<IUser>): Promise<IUser | null> {
    return User.findOne(filter).select('+password');
  }

  async findAll(filter: FilterQuery<IUser> = {}): Promise<IUser[]> {
    return User.find(filter);
  }

  async findPaginated(filter: FilterQuery<IUser>, skip: number, limit: number): Promise<{ items: IUser[], total: number }> {
    const [items, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ]);
    return { items, total };
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return !!result;
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const user = await User.findById(id);
    if (!user) return false;
    await user.softDelete(deletedBy);
    return true;
  }
}

export const userRepository = new UserRepository();
