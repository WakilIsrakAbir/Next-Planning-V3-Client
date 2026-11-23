// ---------- response of GET /api/monitor/stats ----------
export interface CollectionStat {
  name: string;
  count: number;
  size: number;
  storageSize: number;
  freeStorageSize: number;
  indexSize: number;
  indexes: number;
}
export interface Snapshot {
  day: string;
  dataSize: number;
  indexSize: number;
  storageSize: number;
}
export interface UploadCategory {
  category: string;
  uploads: number;
  copiesDeleted: number;
  copiesKept: number;
  copyBytes: number;
  lastAt: string;
  lastBy: string;
}
export interface UploadDay {
  day: string;
  total: number;
  byCategory: Record<string, number>;
}
export interface MonitorStats {
  generatedAt: string;
  canDownloadBackup: boolean;
  database: {
    name: string;
    serverVersion: string;
    dataSize: number;
    indexSize: number;
    storageSize: number;
    freeStorageSize: number;
    objects: number;
    collections: number;
    limitBytes: number;
  };
  collections: CollectionStat[];
  orders: {
    total: number;
    active: number;
    departments: Record<string, Record<string, number>>;
    // false when that department's file was never uploaded (Finishing, for one)
    fileUploaded?: Record<string, boolean>;
  };
  plans: { saved: number; completed: Record<string, number> };
  users: { total: number; online: number };
  uploads: { categories: UploadCategory[]; perDay: UploadDay[] };
  history: Snapshot[];
  backups: { last: { at: string; by: string; bytes: number } | null; count: number };
}

// Tooltip content shown by the charts.
export interface TipRow {
  value: string;
  label?: string;
  color?: string;
}
export interface TipState {
  x: number;
  y: number;
  title: string;
  rows: TipRow[];
}
export type ShowTip = (x: number, y: number, title: string, rows: TipRow[]) => void;

export type ChartId = 'history' | 'collections' | 'status' | 'uploads';
