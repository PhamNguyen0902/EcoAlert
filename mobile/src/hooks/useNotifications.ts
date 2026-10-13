import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notificationService } from "../api/notificationService";
import { useProfile } from "./useAuth";

export const useNotifications = (page = 1, limit = 20) => {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["notifications", page, limit, profile?._id],
    queryFn: () => notificationService.getNotifications(page, limit),
    enabled: Boolean(profile?._id),
    staleTime: 30_000,
  });
};

export const useInfiniteNotifications = () => {
  const { data: profile } = useProfile();
  return useInfiniteQuery({
    queryKey: ["notifications", "infinite", profile?._id],
    enabled: Boolean(profile?._id),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      notificationService.getNotifications(pageParam, 20),
    getNextPageParam: (last, pages) =>
      pages.reduce((count, page) => count + page.items.length, 0) <
        last.total && last.items.length > 0
        ? pages.length + 1
        : undefined,
    staleTime: 30_000,
  });
};

export const useUnreadNotificationCount = () => {
  const { data: profile } = useProfile();
  return useQuery({
    queryKey: ["notifications-unread-count", profile?._id],
    queryFn: notificationService.getUnreadCount,
    enabled: Boolean(profile?._id),
    staleTime: 45_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
};

const useNotificationMutation = <T>(
  mutationFn: (variables: T) => Promise<unknown>,
) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["notifications"] }),
        client.invalidateQueries({ queryKey: ["notifications-unread-count"] }),
      ]);
    },
  });
};
export const useMarkNotificationRead = () =>
  useNotificationMutation(notificationService.markAsRead);
export const useMarkAllNotificationsRead = () =>
  useNotificationMutation<void>(notificationService.markAllAsRead);
export const useDeleteNotification = () =>
  useNotificationMutation(notificationService.deleteNotification);
