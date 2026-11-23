'use client';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type {
  DirectoryUser,
  OpenPermissionBuilder,
  PermissionCounts,
  PermissionSet,
} from '@/features/management/users/types';
import UserCard from '@/features/management/users/components/UserCard';

interface UserDirectoryProps {
  loading: boolean;
  filteredUsers: DirectoryUser[];
  getPermCounts: (p: PermissionSet | null | undefined) => PermissionCounts;
  totalMenuCount: number;
  totalActionCount: number;
  totalDownloadCount: number;
  handleDeleteUser: (id: string, name: string) => Promise<void>;
  handleToggleStatus: (user: DirectoryUser) => Promise<void>;
  openPermissionBuilder: OpenPermissionBuilder;
  openEditModal: (u: DirectoryUser) => void;
}

export default function UserDirectory({
  loading,
  filteredUsers,
  getPermCounts,
  totalMenuCount,
  totalActionCount,
  totalDownloadCount,
  handleDeleteUser,
  handleToggleStatus,
  openPermissionBuilder,
  openEditModal,
}: UserDirectoryProps) {
  return loading ? (
    <div className="flex h-48 items-center justify-center">
      <LoadingSpinner message="Loading Directory..." size="sm" overlay={false} />
    </div>
  ) : filteredUsers.length === 0 ? (
    <div className="card bg-base-100 border border-base-300 p-8 text-center text-sm text-base-content/60">
      No users found matching your filters.
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredUsers.map((u) => (
        <UserCard
          key={u.id}
          u={u}
          getPermCounts={getPermCounts}
          totalMenuCount={totalMenuCount}
          totalActionCount={totalActionCount}
          totalDownloadCount={totalDownloadCount}
          handleDeleteUser={handleDeleteUser}
          handleToggleStatus={handleToggleStatus}
          openPermissionBuilder={openPermissionBuilder}
          openEditModal={openEditModal}
        />
      ))}
    </div>
  );
}
