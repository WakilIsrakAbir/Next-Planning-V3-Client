import type React from 'react';

export type PermissionItem = [key: string, label: string];

export interface MenuGroup {
  key: string;
  title: string;
  icon: React.ReactNode;
  items: PermissionItem[];
}

export interface PermissionGroup {
  title: string;
  icon?: React.ReactNode;
  items: PermissionItem[];
}

export type PermissionFlags = Record<string, boolean>;

export interface BuyerAccess {
  accessType: string;
  buyerIds: string[];
}

/* A user's permissions as the old manage-users.js writes them: { menus, actions, buyers, downloads }.
   Keys this page does not know (written by another page or by the old app) are kept as they are. */
export interface PermissionSet {
  menus: Record<string, PermissionFlags>;
  actions: PermissionFlags;
  buyers: BuyerAccess;
  downloads: PermissionFlags;
  [otherKey: string]: unknown;
}

export interface ApiUser {
  _id?: string;
  id?: string;
  username?: string;
  role?: string;
  status?: string;
  permissions?: unknown;
  lastActive?: string;
  createdAt?: string;
}

export interface DirectoryUser {
  id: string;
  username: string;
  role: string;
  status: string;
  permissions: PermissionSet;
}

export type PermissionScope = 'create' | 'edit' | 'user';

export type PermissionTab = 'menu' | 'actions' | 'buyers' | 'downloads';

export type BuyerOption = { id: string; name: string };

export type PermissionCounts = { menu: number; action: number; download: number };

export type OpenPermissionBuilder = (
  scope: PermissionScope,
  source: PermissionSet,
  target?: { id: string; username: string } | null
) => void;
