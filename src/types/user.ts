export type UserRole = 'Admin' | 'Approver' | 'Planner' | 'Viewer';

export interface IUserPermissions {
  menus?: {
    dashboard?: boolean;
    dataManagement?: {
      upload?: boolean;
      setup?: boolean;
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
  };
  buyers?: {
    accessType: 'all' | 'selected' | 'none';
    buyerIds?: string[];
  };
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
