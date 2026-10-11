export interface Recipient {
  userId: string;
  role: string;
}
export const sharedRecipients = ["system", "officers", "admins"];
export function visibleRecipients({ userId, role }: Recipient): string[] {
  return [
    userId,
    "system",
    ...(role === "OFFICER" ? ["officers"] : []),
    ...(role === "ADMIN" ? ["admins"] : []),
  ];
}
export function visibleQuery(identity: Recipient) {
  return {
    recipientId: { $in: visibleRecipients(identity) },
    dismissedBy: { $ne: identity.userId },
  };
}
export function unreadQuery(identity: Recipient) {
  return {
    ...visibleQuery(identity),
    $or: [
      { recipientId: identity.userId, isRead: { $ne: true } },
      {
        recipientId: { $in: sharedRecipients },
        readBy: { $ne: identity.userId },
      },
    ],
  };
}
export function isReadFor(
  record: { recipientId: string; isRead: boolean; readBy?: string[] },
  userId: string,
) {
  return sharedRecipients.includes(record.recipientId)
    ? Boolean(record.readBy?.includes(userId))
    : record.isRead;
}
