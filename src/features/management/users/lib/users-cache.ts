import type { ApiUser, PermissionItem } from '@/features/management/users/types';

// Module-level cache for instant tab loading
export const usersCache: {
  users: ApiUser[] | null;
  buyersList: { id: string; name: string }[] | null;
  batchUnitItems: PermissionItem[] | null;
} = {
  users: null,
  buyersList: null,
  batchUnitItems: null,
};
