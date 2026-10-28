export type UserRole = 'Admin' | 'Approver' | 'Planner' | 'Viewer';

export interface IUserPermissions {
  menus?: {
    dashboard?: boolean;
    dataManagement?: {
      upload?: boolean;
      setup?: boolean;
      view?: boolean;
      dyeingMc?: boolean;
      flatAllowance?: boolean;
      unitSetup?: boolean;
    };
    /* Batch Plan / Batch Card: "all" is the all-orders switch; every other key is a Dyeing Plan unit
       key in lower case (efl, ekl, ext, pluvia, outside, or a unit from GET /api/batch/units). */
    batchPlan?: BatchUnitMenuPermissions;
    batchCard?: BatchUnitMenuPermissions;
    batchReport?: {
      dyeableBatch?: boolean;
      dyeableSummary?: boolean;
      dailyConfirm?: boolean;
    };
    orderPlanning?: {
      yd?: boolean;
      knitting?: boolean;
      dyeing?: boolean;
      finishing?: boolean;
      delivery?: boolean;
    };
    reports?: {
      yd?: boolean;
      knitting?: boolean;
      dyeing?: boolean;
      finishing?: boolean;
      delivery?: boolean;
      orderStatus?: boolean;
      productInfo?: boolean;
      planningProdInfo?: boolean;
    };
    tracking?: {
      yd?: boolean;
      knitting?: boolean;
      dyeing?: boolean;
      finishing?: boolean;
      delivery?: boolean;
      deliveryFloor?: boolean;
    };
    loadCalculation?: {
      detailed?: boolean;
      summary?: boolean;
    };
  };
  actions?: {
    uploadGeneral?: boolean;
    uploadDept?: boolean;
    saveYD?: boolean;
    saveKnitting?: boolean;
    saveDyeing?: boolean;
    saveFinishing?: boolean;
    saveDelivery?: boolean;
    saveActualYD?: boolean;
    saveActualKnitting?: boolean;
    saveActualDyeing?: boolean;
    saveActualFinishing?: boolean;
    saveActualDelivery?: boolean;
    saveActualDeliveryFloor?: boolean;
    exportExcel?: boolean;
    exportPdf?: boolean;
    uploadBP?: boolean;
    batchEdit?: boolean;
    batchTentative?: boolean;
    batchConfirm?: boolean;
    batchInternalChange?: boolean;
    batchMovePending?: boolean;
    batchCardGenerate?: boolean;
  };
  buyers?: {
    accessType: 'all' | 'selected' | 'none';
    buyerIds?: string[];
  };
  downloads?: {
    batchPlanPrint?: boolean;
    batchCardPrint?: boolean;
    dyeableExcel?: boolean;
    dyeableSummaryExcel?: boolean;
    dailyConfirmExcel?: boolean;
    [downloadKey: string]: boolean | undefined;
  };
}

export interface BatchUnitMenuPermissions {
  all?: boolean;
  [unitKey: string]: boolean | undefined;
}

export interface IUser {
  id?: string;
  _id?: string;
  username: string;
  role: UserRole;
  status: 'active' | 'inactive';
  permissions: IUserPermissions;
  lastActive?: string;
  createdAt?: string;
}

export interface ILoginResponse {
  message: string;
  token: string;
  sessionExpiresAt: number;
  user: IUser;
}
