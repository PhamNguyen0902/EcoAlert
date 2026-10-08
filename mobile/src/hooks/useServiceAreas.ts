import { useInfiniteQuery } from "@tanstack/react-query";
import { serviceAreaService } from "../api/serviceAreaService";
export const useAssignedServiceAreas = (officerId?: string) =>
  useInfiniteQuery({
    queryKey: ["officer-service-areas", officerId],
    enabled: !!officerId,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => serviceAreaService.mine(pageParam),
    getNextPageParam: (last, pages) =>
      last.items.length &&
      pages.reduce((n, p) => n + p.items.length, 0) < last.total
        ? pages.length + 1
        : undefined,
    staleTime: 30_000,
  });
