import { Alert, IAlert } from '../models/alert.model';
import { IBaseRepository } from '@ecoalert/shared';
import { FilterQuery } from 'mongoose';

export class AlertRepository implements IBaseRepository<IAlert> {
  async create(data: Partial<IAlert>): Promise<IAlert> {
    const alert = new Alert(data);
    return alert.save();
  }

  async findById(id: string): Promise<IAlert | null> {
    return Alert.findById(id);
  }

  async findOne(filter: FilterQuery<IAlert>): Promise<IAlert | null> {
    return Alert.findOne(filter);
  }

  async findAll(filter: FilterQuery<IAlert> = {}): Promise<IAlert[]> {
    return Alert.find(filter).sort({ createdAt: -1 });
  }

  async findPaginated(filter: FilterQuery<IAlert>, skip: number, limit: number): Promise<{ items: IAlert[], total: number }> {
    const [items, total] = await Promise.all([
      Alert.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Alert.countDocuments(filter)
    ]);
    return { items, total };
  }

  async update(id: string, data: Partial<IAlert>): Promise<IAlert | null> {
    return Alert.findByIdAndUpdate(id, { $set: data }, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await Alert.findByIdAndDelete(id);
    return !!result;
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const alert = await Alert.findById(id);
    if (!alert) return false;
    await alert.softDelete(deletedBy);
    return true;
  }
}

export const alertRepository = new AlertRepository();
