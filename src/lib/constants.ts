export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface IDepartmentConfig {
  key: string;
  name: string;
  color: string;
  saveActionKey: string;
  actualSaveKey: string;
}

export const DEPARTMENTS: Record<string, IDepartmentConfig> = {
  yd: {
    key: 'yd',
    name: 'YD Plan',
    color: '#0284c7', // Sky Blue
    saveActionKey: 'saveYD',
    actualSaveKey: 'saveActualYD',
  },
  knitting: {
    key: 'knitting',
    name: 'Knitting Plan',
    color: '#10b981', // Emerald Green
    saveActionKey: 'saveKnitting',
    actualSaveKey: 'saveActualKnitting',
  },
  dyeing: {
    key: 'dyeing',
    name: 'Dyeing Plan',
    color: '#8b5cf6', // Violet
    saveActionKey: 'saveDyeing',
    actualSaveKey: 'saveActualDyeing',
  },
  finishing: {
    key: 'finishing',
    name: 'Finishing Plan',
    color: '#f59e0b', // Amber
    saveActionKey: 'saveFinishing',
    actualSaveKey: 'saveActualFinishing',
  },
  delivery: {
    key: 'delivery',
    name: 'Delivery Plan',
    color: '#ec4899', // Pink
    saveActionKey: 'saveDelivery',
    actualSaveKey: 'saveActualDelivery',
  },
};

export const STATUS_COLORS: Record<string, string> = {
  Pending: 'badge-warning',
  Tentative: 'badge-accent',
  Confirm: 'badge-success',
  Completed: 'badge-neutral',
};
