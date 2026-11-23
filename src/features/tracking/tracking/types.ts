// Editable actual-tracking fields per order (saved as `actualData`).
export interface TrackingEdit {
  actualStart: string;
  actualEnd: string;
  failReason: string;
  relatedDept: string;
}

// One row of /api/orders/tracking/:dept.
export interface TrackingOrder {
  orderNo: string;
  buyer?: string;
  extProd?: string | number | null;
  extBal?: string | number | null;
  planStart?: string;
  planEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  failReason?: string;
  relatedDept?: string;
}
