import { useQuery } from "@tanstack/react-query";
import { userService } from "../api/userService";

export const useOfficers = (enabled = true) => {
  return useQuery({
    queryKey: ["users", "officers"],
    queryFn: userService.getOfficers,
    enabled,
    staleTime: 60 * 1000,
  });
};
