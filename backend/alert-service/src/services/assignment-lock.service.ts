import { randomUUID } from "crypto";
import { ConflictError, createLogger } from "@ecoalert/shared";
import { AssignmentLock } from "../models/assignment-lock.model";
export async function withAssignmentLock<T>(
  work: (assertOwned: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const owner = randomUUID(),
    key = "officer-dispatch";
  try {
    const lock = await AssignmentLock.findOneAndUpdate(
      { _id: key, $or: [{ expiresAt: { $lte: new Date() } }, { owner }] },
      { $set: { owner, expiresAt: new Date(Date.now() + 60_000) } },
      { upsert: true, new: true },
    );
    if (!lock)
      throw new ConflictError("Phân công đang được xử lý. Vui lòng thử lại.");
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      throw new ConflictError("Phân công đang được xử lý. Vui lòng thử lại.");
    throw error;
  }
  const assertOwned = async () => {
    const lock = await AssignmentLock.findOneAndUpdate(
      { _id: key, owner, expiresAt: { $gt: new Date() } },
      { $set: { expiresAt: new Date(Date.now() + 60_000) } },
    );
    if (!lock)
      throw new ConflictError("Phiên phân công đã hết hạn. Vui lòng thử lại.");
  };
  try {
    return await work(assertOwned);
  } finally {
    await AssignmentLock.updateOne(
      { _id: key, owner },
      { $set: { expiresAt: new Date(0) } },
    ).catch(() =>
      createLogger("assignment").warn(
        "Dispatch lease release failed; lease will expire",
      ),
    );
  }
}
