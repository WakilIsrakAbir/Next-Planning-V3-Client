'use client';

import React from 'react';
import { Check, X, Download, Database, Lock, Tag } from 'lucide-react';
import InlineSpinner from '@/components/ui/InlineSpinner';
import type {
  BuyerOption,
  MenuGroup,
  PermissionScope,
  PermissionSet,
  PermissionTab,
} from '@/features/management/users/types';
import MenuPermissionsTab from '@/features/management/users/components/MenuPermissionsTab';
import ActionPermissionsTab from '@/features/management/users/components/ActionPermissionsTab';
import BuyerAccessTab from '@/features/management/users/components/BuyerAccessTab';
import DownloadPermissionsTab from '@/features/management/users/components/DownloadPermissionsTab';

interface PermissionBuilderModalProps {
  permModalTitle: string;
  permModalScope: PermissionScope;
  permActiveTab: PermissionTab;
  setPermActiveTab: React.Dispatch<React.SetStateAction<PermissionTab>>;
  menuGroups: MenuGroup[];
  permDraft: PermissionSet;
  permDraftBase: PermissionSet | null;
  savingPerms: boolean;
  buyersList: BuyerOption[];
  buyerSearch: string;
  setBuyerSearch: React.Dispatch<React.SetStateAction<string>>;
  updateDraft: (mutate: (draft: PermissionSet) => void) => void;
  setMenuFlags: (groupKey: string, keys: string[], value: boolean) => void;
  setFlags: (section: 'actions' | 'downloads', keys: string[], value: boolean) => void;
  handleBulkTogglePerms: (select: boolean) => void;
  handleApplyPermissions: () => Promise<void>;
  closePermissionBuilder: () => void;
}

// Full 4-Tab Granular Config
export default function PermissionBuilderModal({
  permModalTitle,
  permModalScope,
  permActiveTab,
  setPermActiveTab,
  menuGroups,
  permDraft,
  permDraftBase,
  savingPerms,
  buyersList,
  buyerSearch,
  setBuyerSearch,
  updateDraft,
  setMenuFlags,
  setFlags,
  handleBulkTogglePerms,
  handleApplyPermissions,
  closePermissionBuilder,
}: PermissionBuilderModalProps) {
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
          <div>
            <h3 className="font-black text-base">{permModalTitle}</h3>
            <p className="text-xs text-base-content/60">
              Granular control over menus, workflow actions, permitted buyers, and downloads.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBulkTogglePerms(true)}
              className="btn btn-outline btn-xs btn-success font-bold"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => handleBulkTogglePerms(false)}
              className="btn btn-outline btn-xs font-bold"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={closePermissionBuilder}
              className="btn btn-ghost btn-circle btn-xs"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body: Left Tab Nav & Right Content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left Tab Nav */}
          <div className="w-52 border-r border-base-300 p-3 bg-base-200/40 space-y-1 shrink-0 overflow-y-auto">
            <button
              type="button"
              onClick={() => setPermActiveTab('menu')}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                permActiveTab === 'menu' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
              }`}
            >
              <Database className="h-4 w-4" /> Menu & Submenu
            </button>
            <button
              type="button"
              onClick={() => setPermActiveTab('actions')}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                permActiveTab === 'actions' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
              }`}
            >
              <Lock className="h-4 w-4" /> Save & Actions
            </button>
            <button
              type="button"
              onClick={() => setPermActiveTab('buyers')}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                permActiveTab === 'buyers' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
              }`}
            >
              <Tag className="h-4 w-4" /> Buyer Access
            </button>
            <button
              type="button"
              onClick={() => setPermActiveTab('downloads')}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-bold text-left transition-colors ${
                permActiveTab === 'downloads' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'
              }`}
            >
              <Download className="h-4 w-4" /> Downloads
            </button>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
            {/* TAB 1: MENU & SUBMENU */}
            {permActiveTab === 'menu' && (
              <MenuPermissionsTab
                menuGroups={menuGroups}
                permDraft={permDraft}
                permDraftBase={permDraftBase}
                setMenuFlags={setMenuFlags}
              />
            )}

            {/* TAB 2: SAVE & ACTIONS */}
            {permActiveTab === 'actions' && <ActionPermissionsTab permDraft={permDraft} setFlags={setFlags} />}

            {/* TAB 3: BUYER ACCESS */}
            {permActiveTab === 'buyers' && (
              <BuyerAccessTab
                permDraft={permDraft}
                updateDraft={updateDraft}
                buyersList={buyersList}
                buyerSearch={buyerSearch}
                setBuyerSearch={setBuyerSearch}
              />
            )}

            {/* TAB 4: DOWNLOADS */}
            {permActiveTab === 'downloads' && <DownloadPermissionsTab permDraft={permDraft} setFlags={setFlags} />}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-base-300 flex items-center justify-between bg-base-200/50">
          <span className="text-xs text-base-content/60 font-semibold">
            {permModalScope === 'user'
              ? 'Click "Save Permissions" to store these access rules for this user.'
              : 'Click "Apply Permissions" to commit these access rules.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closePermissionBuilder}
              className="btn btn-ghost btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApplyPermissions()}
              disabled={savingPerms}
              className="btn btn-primary btn-sm font-bold gap-1.5"
            >
              {savingPerms ? <InlineSpinner size={14} /> : <Check className="h-4 w-4" />}
              {permModalScope === 'user' ? 'Save Permissions' : 'Apply Permissions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
