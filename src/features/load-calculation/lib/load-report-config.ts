export const LOAD_DEPTS = [
  { key: 'yd', label: 'YD', pendingQtyField: 'YD DELIVERY BALANCE', colorClass: 'bg-purple-600 hover:bg-purple-700 text-white', activeClass: 'bg-purple-600 text-white border-purple-600 shadow-md' },
  { key: 'knitting', label: 'Knitting', pendingQtyField: 'KnitBala', colorClass: 'bg-blue-600 hover:bg-blue-700 text-white', activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md' },
  { key: 'dyeing', label: 'Dyeing', pendingQtyField: 'DyeingBala', colorClass: 'bg-green-600 hover:bg-green-700 text-white', activeClass: 'bg-green-600 text-white border-green-600 shadow-md' },
  { key: 'delivery', label: 'Delivery', pendingQtyField: 'DeliBal', colorClass: 'bg-orange-500 hover:bg-orange-600 text-white', activeClass: 'bg-orange-500 text-white border-orange-500 shadow-md' },
  { key: 'deliveryfloor', label: 'Delivery (Floor)', pendingQtyField: 'DeliBal', colorClass: 'bg-amber-600 hover:bg-amber-700 text-white', activeClass: 'bg-amber-600 text-white border-amber-600 shadow-md' },
];

export const LOAD_REPORT_CONFIG: Record<
  string,
  {
    name: string;
    pendingQtyField: string;
    columns: string[];
  }
> = {
  knitting: {
    name: 'Knitting',
    pendingQtyField: 'KnitBala',
    columns: ['OrderNo', 'Color', 'FabricConstruction', 'GSM', 'Buyer', 'GreyReq', 'KnitProd', 'KnitBala'],
  },
  dyeing: {
    name: 'Dyeing',
    pendingQtyField: 'DyeingBala',
    columns: [
      'OrderNo',
      'Color',
      'RequiredQtyKgs',
      'Buyer',
      'Unit',
      'ProcessName',
      'GreyReq',
      'KnitProd',
      'KnitBala',
      'BPQty',
      'DyeingProd',
      'DyeingBala',
    ],
  },
  delivery: {
    name: 'Delivery',
    pendingQtyField: 'DeliBal',
    columns: [
      'OrderNo',
      'Color',
      'FabricConstruction',
      'GSM',
      'Buyer',
      'RequiredQtyKgs',
      'NetReceivedQtyKgs',
      'NetDeliveryQtyKgs',
      'DeliBal',
      'RFD',
      'Slowmoving',
    ],
  },
  yd: {
    name: 'YD',
    pendingQtyField: 'YD DELIVERY BALANCE',
    columns: [
      'OrderNo',
      'Booking Type',
      'YDB',
      'Buyer',
      'YD REQ.',
      'DYED',
      'YD BALANCE',
      'YD Delivered',
      'YD DELIVERY BALANCE',
    ],
  },
  deliveryfloor: {
    name: 'Delivery (Floor)',
    pendingQtyField: 'DeliBal',
    columns: [
      'OrderNo',
      'Color',
      'FabricConstruction',
      'GSM',
      'Buyer',
      'RequiredQtyKgs',
      'NetReceivedQtyKgs',
      'NetDeliveryQtyKgs',
      'DeliBal',
      'RFD',
      'Slowmoving',
    ],
  },
};
