export type JsonObject = Record<string, unknown>;
export type DateField = 'planStart' | 'planEnd' | 'actualStart' | 'actualEnd';
export type TrackingResult = 'Pass' | 'Fail' | '—';

export interface PlanItem {
  itemData?: JsonObject;
  startDate?: string;
  endDate?: string;
  floorStartDate?: string;
  floorEndDate?: string;
  floorPlanType?: string;
  [key: string]: unknown;
}

export interface ActualInfo {
  actualStart?: string;
  actualEnd?: string;
  failReason?: string;
  remarks?: string;
  relatedDept?: string;
}

export interface PlanDoc {
  orderNo: string;
  buyer?: string;
  unit?: string;
  processName?: string;
  [key: string]: unknown;
}

export interface OrderInfo {
  buyer?: string;
  knitStart?: string;
  knitEnd?: string;
  dyeStart?: string;
  dyeEnd?: string;
  deliStart?: string;
  deliEnd?: string;
  [key: string]: unknown;
}

export interface TrackingRow {
  orderNo: string;
  buyer: string;
  unit: string;
  processName: string;
  planStart: string;
  planEnd: string;
  actualStart: string;
  actualEnd: string;
  failReason: string;
  relatedDept: string;
}

export interface TrackingResultRow extends TrackingRow {
  startResult: TrackingResult;
  endResult: TrackingResult;
}

export interface TrackingDataset {
  rows: TrackingRow[];
  buyers: string[];
  /** Unit filter options (only filled for Dyeing / Delivery / Delivery (Floor)). */
  units: string[];
}

/** Pass / Fail summary of the previewed rows. */
export interface TrackingMetrics {
  total: number;
  startPass: number;
  startPassPct: string;
  startFail: number;
  startFailPct: string;
  endPass: number;
  endPassPct: string;
  endFail: number;
  endFailPct: string;
}
