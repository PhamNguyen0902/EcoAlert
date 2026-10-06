/** The producer uses UUID eventId values. Never treat these as alert IDs. */
export const getNotificationAlertId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object" || !("alertId" in payload))
    return null;
  const id = payload.alertId;
  return typeof id === "string" && /^[a-f\d]{24}$/i.test(id) ? id : null;
};

export const unreadBadgeLabel = (count: number): string | null =>
  Number.isFinite(count) && count >= 1
    ? count > 9
      ? "9+"
      : String(Math.floor(count))
    : null;

export interface NotificationTarget {
  alertId: string | null;
  requestId: string;
}

/** Holds cold-start taps until both navigation and the Citizen session are ready. */
export class NotificationTapQueue {
  private pending: NotificationTarget | null = null;
  private seen = new Set<string>();
  enqueue(payload: unknown, requestId: string) {
    if (this.seen.has(requestId) || this.pending?.requestId === requestId)
      return;
    this.pending = { alertId: getNotificationAlertId(payload), requestId };
  }
  flush(
    ready: boolean,
    routeNames: readonly string[],
    navigate: (target: NotificationTarget) => void,
  ): boolean {
    if (!this.pending || !ready) return false;
    // Keep a guest tap queued through login. Do not redirect Officer/Admin flows.
    if (!routeNames.includes("CitizenApp")) {
      if (
        routeNames.includes("OfficerApp") ||
        routeNames.includes("AdminApp")
      ) {
        this.pending = null;
        return true; // Consumed without changing a non-Citizen workflow.
      }
      return false;
    }
    const target = this.pending;
    this.pending = null;
    this.seen.add(target.requestId);
    if (this.seen.size > 100) {
      const oldest = this.seen.values().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    navigate(target);
    return true;
  }
}
