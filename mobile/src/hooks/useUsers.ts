import { useQuery } from '@tanstack/react-query';
import { userService } from '../api/userService';

export const useOfficers = (enabled = true) =>
  useQuery({
    queryKey: ['users', 'officers'],
    queryFn: userService.getOfficers,
    enabled,
    staleTime: 60 * 1000,
  });

export const useUser = (id?: string) =>
  useQuery({
    queryKey: ['user', id],
    queryFn: () => (id ? userService.getUserById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
