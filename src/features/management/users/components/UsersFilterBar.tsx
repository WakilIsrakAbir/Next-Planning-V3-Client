'use client';

import React from 'react';
import { Search } from 'lucide-react';

interface UsersFilterBarProps {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  roleFilter: string;
  setRoleFilter: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
}

export default function UsersFilterBar({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
}: UsersFilterBarProps) {
  return (
    <div className="card bg-base-100 border border-base-300 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Search user or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-bordered input-sm w-full pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="select select-bordered select-sm text-xs"
          >
            <option value="all">All Roles</option>
            <option value="Admin">Admin</option>
            <option value="Approver">Approver</option>
            <option value="Planner">Planner</option>
            <option value="Viewer">Viewer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select select-bordered select-sm text-xs"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
    </div>
  );
}
