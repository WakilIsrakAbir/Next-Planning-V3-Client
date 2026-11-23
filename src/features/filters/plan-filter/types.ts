export type Cell = string | number | boolean | null | undefined;
export type PfRow = Record<string, Cell>;
export type JsonObject = Record<string, unknown>;

export interface PlanItem {
  itemData?: JsonObject;
  planType?: string;
  floorPlanType?: string;
  startDate?: string;
  endDate?: string;
  floorStartDate?: string;
  floorEndDate?: string;
  [key: string]: unknown;
}

export interface PlanDoc {
  orderNo: string;
  buyer?: string;
  color?: string;
  [key: string]: unknown;
}

export interface OrderInfo {
  orderNo?: string;
  buyer?: string;
  floor?: string;
  programType?: string;
  knitStart?: string;
  knitEnd?: string;
  dyeStart?: string;
  dyeEnd?: string;
  deliStart?: string;
  deliEnd?: string;
  ydStart?: string;
  ydEnd?: string;
  [key: string]: unknown;
}

export interface PfDataset {
  rows: PfRow[];
  buyers: string[];
  /** Unit filter options (only filled for departments with the Unit filter). */
  units: string[];
}
