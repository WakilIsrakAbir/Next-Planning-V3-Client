// Metric Rules matching Exp prod-info.js
export interface MetricRule {
  label: string;
  source: 'knitting' | 'dyeing' | 'delivery';
  fields: string[];
  mode: 'average' | 'sum';
  percent?: boolean;
}

export const PI_METRIC_RULES: MetricRule[] = [
  {
    label: 'Allowance',
    source: 'knitting',
    fields: ['Allowance', 'Allowance %', 'Allow'],
    mode: 'average',
    percent: true,
  },
  {
    label: 'Allocated Qty',
    source: 'knitting',
    fields: ['Allocated Qty', 'Allocated Qty ', 'AllocatedQty', 'Alloc Qty'],
    mode: 'sum',
  },
  {
    label: 'Yarn bala.',
    source: 'knitting',
    fields: ['Yarn bala.', 'Yarn Bala', 'YarnBala', 'Yarn Balance'],
    mode: 'sum',
  },
  {
    label: 'Knit Prod.',
    source: 'knitting',
    fields: ['Knit Prod.', 'KnitProd', 'Knit Production', 'Knit Prod'],
    mode: 'sum',
  },
  {
    label: 'Knit. Bala.',
    source: 'knitting',
    fields: ['Knit. Bala.', 'KnitBala', 'Knit Bala', 'Knit Balance', 'Knit. Bal.'],
    mode: 'sum',
  },
  {
    label: 'Dyeing ok',
    source: 'dyeing',
    fields: ['Dyeing ok', 'Dyeing Prod.', 'DyeingProd', 'Dyeing Prod', 'Dyeing Production'],
    mode: 'sum',
  },
  {
    label: 'Dyeing Bal.',
    source: 'dyeing',
    fields: ['Dyeing Bal.', 'Dyeing Bala.', 'DyeingBala', 'Dyeing Balance', 'Dye Bal'],
    mode: 'sum',
  },
  {
    label: 'RequiredQtyKgs',
    source: 'delivery',
    fields: ['RequiredQtyKgs', 'Required Qty Kgs', 'Required Qty', 'Req Qty', 'Qty'],
    mode: 'sum',
  },
  {
    label: 'NetReceivedQtyKgs',
    source: 'delivery',
    fields: ['NetReceivedQtyKgs', 'Net Received Qty Kgs', 'Net Received Qty', 'Received Qty'],
    mode: 'sum',
  },
  {
    label: 'NetDeliveryQtyKgs',
    source: 'delivery',
    fields: ['NetDeliveryQtyKgs', 'Net Delivery Qty Kgs', 'NetDeliveryQty', 'Delivery Qty', 'DeliveryQty'],
    mode: 'sum',
  },
  {
    label: 'Deli. Bala.',
    source: 'delivery',
    fields: ['Deli. Bala.', 'Deli. Bal.', 'DeliBal', 'Deli Bal.', 'Delivery Balance', 'Deli Bal'],
    mode: 'sum',
  },
  { label: 'RFD', source: 'delivery', fields: ['RFD'], mode: 'sum' },
  {
    label: 'Slowmoving',
    source: 'delivery',
    fields: ['Slowmoving', 'Slow Moving', 'SlowMoving'],
    mode: 'sum',
  },
  {
    label: 'FF Stock',
    source: 'delivery',
    fields: ['FF Stock', 'FFStock', 'FF_Stock'],
    mode: 'sum',
  },
];
