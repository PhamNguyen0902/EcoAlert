import { Alert, IAlert } from "../models/alert.model";
import { IBaseRepository } from "@ecoalert/shared";
import { FilterQuery, UpdateQuery } from "mongoose";

export class AlertRepository implements IBaseRepository<IAlert> {
  //lưu vào mongoDB
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

  async findPaginated(
    filter: FilterQuery<IAlert>,
    skip: number,
    limit: number,
  ): Promise<{ items: IAlert[]; total: number }> {
    const includeDeleted = filter.includeDeleted;
    const queryFilter = { ...filter };
    delete queryFilter.includeDeleted;

    if (!includeDeleted && queryFilter.isDeleted === undefined) {
      queryFilter.isDeleted = false;
    }

    const [items, total] = await Promise.all([
      Alert.find(queryFilter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Alert.countDocuments(queryFilter),
    ]);
    return { items, total };
  }

  async update(id: string, data: Partial<IAlert>): Promise<IAlert | null> {
    return Alert.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: "after" },
    );
  }

  async findOneAndUpdate(
    filter: FilterQuery<IAlert>,
    update: UpdateQuery<IAlert>,
  ): Promise<IAlert | null> {
    return Alert.findOneAndUpdate(filter, update, {
      returnDocument: "after",
      runValidators: true,
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await Alert.findByIdAndDelete(id);
    return !!result;
  }

  async findNearby(
    longitude: number,
    latitude: number,
    radiusMeters: number = 200,
    statuses: string[] = ["pending", "ai_analyzing", "assigned", "in_progress"],
  ): Promise<IAlert[]> {
    return Alert.find({
      isDeleted: false,
      status: { $in: statuses.map((s) => new RegExp(`^${s}$`, "i")) },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusMeters,
        },
      },
    }).limit(10);
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    const alert = await Alert.findById(id);
    if (!alert) return false;
    await alert.softDelete(deletedBy);
    return true;
  }
}

export const alertRepository = new AlertRepository();
