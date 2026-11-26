import { requireVerifiedRoles, UserRole } from '@ecoalert/shared';

export const requireAuth = requireVerifiedRoles(Object.values(UserRole));

export const requireRoles = (roles: UserRole[]) => {
  return requireVerifiedRoles(roles.map((r) => r.toUpperCase()));
};
