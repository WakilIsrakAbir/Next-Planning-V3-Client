// Orders, saved plans and Excel rows are free-form JSON shared with the old app (as in the page itself).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = any;

export type Dept = 'yd' | 'knitting' | 'dyeing' | 'finishing' | 'delivery';
export const DEPTS: Dept[] = ['yd', 'knitting', 'dyeing', 'finishing', 'delivery'];

/** The documents the mocked server holds, as the real server stores them (raw MongoDB documents as JSON). */
export interface FixtureDb {
  orders: Loose[];
  orderDates: Loose[];
  /** DropdownMaster documents in the order the server reads them (createdAt ascending). */
  dropdownmasters: Loose[];
}

export interface Fixture extends FixtureDb {
  /** File name without .json, e.g. "knit-basic" or "local/knitting-01". */
  name: string;
  /** The order the scenario opens. */
  orderNo: string;
  /** What this fixture is built to show (synthetic fixtures). */
  about?: string;
}

/** A scripted reply to the next request of one kind (instead of the server's normal answer). */
export interface ScriptedReply {
  status?: number;
  json?: Loose;
  text?: string;
  /** fetch() rejects with TypeError('Failed to fetch'), as a browser does on a network error. */
  networkError?: boolean;
  /** The server handles the request normally but the reply is held until a `release` step. */
  hold?: boolean;
}

export type Step =
  | { do: 'load'; replyDetail?: ScriptedReply; replyDropdowns?: ScriptedReply }
  /** `optional`: skip (and record that) when the field is missing or disabled; used by the real-data scripts. */
  | { do: 'set'; row: number; field: string; value: string; optional?: boolean }
  | { do: 'type'; row: number; field: string; text: string }
  | { do: 'status'; value: string }
  | { do: 'save'; via?: 'header' | 'footer'; confirm?: boolean[]; reply?: ScriptedReply }
  | { do: 'back'; via?: 'icon' | 'header' | 'footer' }
  | { do: 'release' }
  | { do: 'wait'; ms: number }
  | { do: 'reopen'; replyDetail?: ScriptedReply; replyDropdowns?: ScriptedReply };

export type RoleName = 'admin' | 'planner' | 'approver' | 'viewer' | 'none' | 'lowerApprover';

/**
 * Checks that prove a scenario really shows its rules (step numbers are 1-based). They are evaluated on
 * every run, in record and in compare mode; the recording itself holds the full detail.
 */
export type Expectation =
  /** A toast with exactly this text appeared during the step. */
  | { step: number; toast: string }
  /** No toast appeared during the step. */
  | { step: number; noToast: true }
  /** window.confirm was called with exactly this text during the step. */
  | { step: number; confirm: string }
  /** A POST /api/orders/save-dates was (true) or was not (false) sent during the step. */
  | { step: number; saved: boolean }
  /** State of one field after the step; `min: null` means the attribute is absent. */
  | { step: number; field: [number, string]; value?: string; disabled?: boolean; title?: string | null; min?: string | null }
  /** Value of the General Info Order Status select after the step. */
  | { step: number; status: string }
  /** A router call ("push:/planning/knitting" or "back") during the step. */
  | { step: number; router: string }
  /** Text of one table cell (row, column) after the step. */
  | { step: number; cell: [number, number]; text: string }
  /** Something about the saved request body of the step: fabricItems[i][key] (or body[key] when item is omitted). */
  | { step: number; body: { item?: number; key: string; itemData?: boolean; equals: Loose } };

export interface Scenario {
  /** Unique id; also the recording file name, e.g. "knitting/cas01-start-copy-down/admin". */
  id: string;
  fixture: string;
  dept: Dept | string;
  role: RoleName;
  /** Order number in the URL (defaults to the fixture's orderNo). */
  orderNo?: string;
  /** window.history.length when the page opens (default 1: opened in a new tab, so Back pushes the list URL). */
  historyLength?: number;
  /** Rule ids this scenario is meant to show (tests/golden/RULES.md is built from these). */
  rules: string[];
  note?: string;
  steps: Step[];
  expect?: Expectation[];
}
