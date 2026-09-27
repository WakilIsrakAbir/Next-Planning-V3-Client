export type DepartmentKey = 'yd' | 'knitting' | 'dyeing' | 'finishing' | 'delivery' | 'deliveryfloor';
export type PlanStatus = 'Pending' | 'Confirm' | 'Tentative' | 'Completed';

export interface IFabricItem {
  itemId?: string;
  orderNo?: string;
  color?: string;
  fabricConstruction?: string;
  gsm?: string | number;
  reqQty?: string | number;
  greyReq?: string | number;
  knitProd?: string | number;
  knitBala?: string | number;
  yarnReq?: string | number;
  allocatedQty?: string | number;
  yarnBala?: string | number;
  allowance?: string | number;
  dyeingProd?: string | number;
  dyeingBala?: string | number;
  bpQty?: string | number;
  netDeliveryQty?: string | number;
  deliBal?: string | number;
  rfd?: string | number;
  slowmoving?: string | number;
  ffStock?: string | number;
  planType?: 'Select' | 'Tentative' | 'Confirm' | '';
  planStart?: string;
  planEnd?: string;
  unit?: string;
  processName?: string;
  remarks?: string;
  [key: string]: any;
}

export interface IOrder {
  _id: string;
  orderNo: string;
  buyer: string;
  bookingDate: string;
  requiredQtyKgs: any;
  bookingBy?: string;
  pmc?: string;
  finalConfirmation?: string;
  eventDay?: any;
  ship1?: string;
  shipLast?: string;
  yarnDate?: string;
  knitStart?: string;
  knitEnd?: string;
  dyeStart?: string;
  dyeEnd?: string;
  deliStart?: string;
  deliEnd?: string;
  fabricNotes?: string;
  status?: string;

  gmtUnit?: string;
  floor?: string;
  buyerTeam?: string;
  bookedBy?: string;
  style?: string;
  bpStatus?: string;
  ald?: string;
  brush?: string;
  peach?: string;
  heatset?: string;
  bodyFabric?: string;
  programType?: string;
  bodyGsm?: any;
  pmcNotes?: string;

  knittingItems?: any[];
  dyeingItems?: any[];
  finishingItems?: any[];
  deliveryItems?: any[];
  ydItems?: any[];

  knittingPlanStatus?: PlanStatus;
  dyeingPlanStatus?: PlanStatus;
  finishingPlanStatus?: PlanStatus;
  deliveryPlanStatus?: PlanStatus;
  ydPlanStatus?: PlanStatus;

  createdAt?: string;
  updatedAt?: string;
}

export interface IOrderDate {
  orderNo: string;
  knitting: IFabricItem[];
  dyeing: IFabricItem[];
  finishing: IFabricItem[];
  delivery: IFabricItem[];
  yd: IFabricItem[];

  knittingStatus: string;
  dyeingStatus: string;
  finishingStatus: string;
  deliveryStatus: string;
  ydStatus: string;

  knittingCompletedDate?: string | null;
  dyeingCompletedDate?: string | null;
  finishingCompletedDate?: string | null;
  deliveryCompletedDate?: string | null;
  ydCompletedDate?: string | null;

  knittingActual?: any;
  dyeingActual?: any;
  finishingActual?: any;
  deliveryActual?: any;
  ydActual?: any;
  deliveryfloorActual?: any;
}

export interface ITrackingOrder {
  orderNo: string;
  buyer: string;
  bookingDate: string;
  planStart: string;
  planEnd: string;
  actualStart: string;
  actualEnd: string;
  actualProd: string;
  actualStatus: string;
  planItems: any[];
}
