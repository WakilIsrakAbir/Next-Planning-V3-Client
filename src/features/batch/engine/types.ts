/* Batch Plan module types.
   Bookings, plan snapshots, Excel rows and batch cards are free-form JSON that the server stores as text
   and the old vanilla-JS page reads too (both apps share the records), so their inner shape is kept
   open with `Row`. The fields the engine relies on are named where it helps. */

// Excel rows, plan snapshots and other free-form JSON shared with the server and the old app.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface BatchUnit {
  key: string;
  label: string;
}

export interface BatchFloor extends BatchUnit {
  aliases: string[];
}

export interface FloorPlan extends Row {
  status?: 'Pending' | 'Tentative' | 'Confirm' | string;
}

/** One order of the Batch Plan register (the General file booking plus its saved plan state). */
export interface Booking extends Row {
  number: string;
  buyer: string;
  status?: string;
  floorPlans?: Record<string, FloorPlan>;
}

export interface BatchUser {
  username?: string;
  role?: string;
  permissions?: Row;
}

/** Everything GET /api/batch/state returns. */
export interface BatchStateResponse {
  user?: BatchUser;
  master?: Booking[];
  planVersions?: Record<string, number>;
  datasets?: { genInfo?: Record<string, Row>; knitPlan?: Record<string, Row[]>; bpData?: Record<string, Row[]> };
  setup?: Row[];
  flatAllowance?: Row[];
  unitSetup?: Row[];
  settingVersions?: Record<string, number>;
  cards?: Row[];
  batchUnits?: BatchUnit[];
  units?: { name: string; status: string }[];
  buyers?: string[];
}

/** The page's saved data (the old appState). */
export interface BatchAppState {
  master: Booking[];
  files: Row[];
  datasets: { genInfo: Record<string, Row>; knitPlan: Record<string, Row[]>; bpData?: Record<string, Row[]> };
  setup: Row[];
  flatAllowance: Row[];
  unitSetup: Row[];
  cards: Row[];
}

/** POST /api/batch/commit body. */
export interface BatchCommitPayload {
  plans: { orderNo: string; version: number; state: Row }[];
  settings: Record<string, { value: Row[]; version: number }>;
  cards: Row[];
}

export interface BatchCommitResult {
  planVersions?: Record<string, number>;
  settingVersions?: Record<string, number>;
}

/** Changes passed to commitChanges (same keys as BatchAppState). */
export type BatchChanges = Partial<BatchAppState>;
