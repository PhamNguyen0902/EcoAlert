import type { Alert, User } from "../../shared/types";
import { getGeoJsonMapCoordinates, type MapCoordinates } from "../../shared/utils/maps";

export function ownsOfficerTask(
  task: Alert | undefined,
  profile: User | null | undefined,
) {
  const owner = task?.assignedOfficerId;
  return Boolean(
    profile?.role === "OFFICER" &&
    owner &&
    (typeof owner === "string" ? owner : owner._id) === profile._id,
  );
}
export const officerReference = (task: Alert) =>
  `#${task._id.slice(-6).toUpperCase()}`;
export const officerDate = (value?: string) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Chưa ghi nhận";
export const officerImage = (task: Alert) =>
  task.fieldEvidence?.[0]?.displayUrl ||
  task.fieldEvidence?.[0]?.originalUrl ||
  task.mediaUrls?.[0];
export function officerDistance(a: MapCoordinates, b: MapCoordinates) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function officerTimeline(task: Alert) {
  const resolved = Boolean(
    task.resolvedAt && Number.isFinite(Date.parse(task.resolvedAt)),
  );
  return [
    { label: "Tiếp nhận phân công", at: task.assignedAt },
    { label: "Bắt đầu xử lý", at: task.startedAt },
    {
      label: "Điểm danh GPS hiện trường",
      at: task.checkIn?.verified ? task.checkIn.checkedInAt : undefined,
    },
    { label: "Gửi minh chứng xử lý", at: task.resolvedAt },
    {
      label: "Chờ Admin nghiệm thu",
      at: resolved ? task.resolvedAt : undefined,
    },
    { label: "Admin xác nhận đóng báo cáo", at: task.closedAt },
  ].map((step) => ({
    ...step,
    done: Boolean(step.at && Number.isFinite(Date.parse(step.at))),
  }));
}
export function searchOfficerTasks(tasks: Alert[], text: string) {
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
  const query = normalized(text.trim());
  return tasks.filter((task) =>
    normalized(`${task.title} ${task.address} ${task._id}`).includes(query),
  );
}
export function taskDistance(task: Alert, position: MapCoordinates | null) {
  const destination = getGeoJsonMapCoordinates(task.location?.coordinates);
  return position && destination
    ? officerDistance(position, destination)
    : null;
}

export function officerElapsedTime(fromIso?: string, nowMs = Date.now()) {
  if (!fromIso || !Number.isFinite(Date.parse(fromIso))) return null;
  const diffSec = Math.max(0, Math.floor((nowMs - Date.parse(fromIso)) / 1000));
  const hours = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (hours > 0) return `${hours} giờ ${mins} phút`;
  if (mins > 0) return `${mins} phút`;
  return "Vừa xong";
}

