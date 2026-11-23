import { getColData } from '@/lib/data-utils';
import { PI_METRIC_RULES } from '@/features/reports/product-info/lib/metric-rules';
import { parseNum } from '@/features/reports/product-info/lib/number-format';
import type { ColorMatrixData, ProductInfoOrder } from '@/features/reports/product-info/types';

/** Compute Color-Wise Specification Matrix (Exp logic) */
export function computeColorMatrix(orderDetails: ProductInfoOrder): ColorMatrixData {
  if (!orderDetails) return { colors: [], metricResults: [] };

  const rawKnittingItems = orderDetails.knittingItems || [];
  const rawDyeingItems = orderDetails.dyeingItems || [];
  const rawDeliveryItems = orderDetails.deliveryItems || [];

  const getColor = (item: any) =>
    String(getColData(item, ['Color', 'Colour', 'Fab Color', 'color', 'colour'])).trim();

  const colorMap = new Map<string, string>();
  [rawKnittingItems, rawDyeingItems, rawDeliveryItems].forEach((items) => {
    items.forEach((item: any) => {
      const color = getColor(item);
      if (!color) return;
      const ck = color.toLowerCase().replace(/\s+/g, ' ');
      if (!colorMap.has(ck)) colorMap.set(ck, color);
    });
  });

  const colors = [...colorMap.entries()].map(([key, label]) => ({ key, label }));

  const getItemsBySource = (source: string) => {
    if (source === 'knitting' && rawKnittingItems.length > 0) return rawKnittingItems;
    if (source === 'dyeing' && rawDyeingItems.length > 0) return rawDyeingItems;
    if (source === 'delivery' && rawDeliveryItems.length > 0) return rawDeliveryItems;
    if (rawKnittingItems.length > 0) return rawKnittingItems;
    if (rawDyeingItems.length > 0) return rawDyeingItems;
    if (rawDeliveryItems.length > 0) return rawDeliveryItems;
    return [];
  };

  // Pre-group items by normalized color key for fast O(1) lookups
  const groupItemsByColor = (items: any[]) => {
    const g = new Map<string, any[]>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const color = getColor(item).toLowerCase().replace(/\s+/g, ' ');
      if (!color) continue;
      let arr = g.get(color);
      if (!arr) {
        arr = [];
        g.set(color, arr);
      }
      arr.push(item);
    }
    return g;
  };

  const groupedKnitting = groupItemsByColor(rawKnittingItems);
  const groupedDyeing = groupItemsByColor(rawDyeingItems);
  const groupedDelivery = groupItemsByColor(rawDeliveryItems);

  const getGroupedBySource = (source: string) => {
    if (source === 'knitting' && rawKnittingItems.length > 0) return groupedKnitting;
    if (source === 'dyeing' && rawDyeingItems.length > 0) return groupedDyeing;
    if (source === 'delivery' && rawDeliveryItems.length > 0) return groupedDelivery;
    if (rawKnittingItems.length > 0) return groupedKnitting;
    if (rawDyeingItems.length > 0) return groupedDyeing;
    if (rawDeliveryItems.length > 0) return groupedDelivery;
    return new Map<string, any[]>();
  };

  const metricResults = PI_METRIC_RULES.map((metric) => {
    const grouped = getGroupedBySource(metric.source);
    const colorValues = colors.map((c) => {
      const matchingItems = grouped.get(c.key);
      if (!matchingItems || matchingItems.length === 0) return null;

      let sum = 0;
      let count = 0;
      for (let i = 0; i < matchingItems.length; i++) {
        const item = matchingItems[i];
        const raw = getColData(item, metric.fields, null);
        const val = parseNum(raw);
        if (val !== null) {
          sum += val;
          count++;
        }
      }

      if (count === 0) return null;
      return metric.mode === 'average' ? sum / count : sum;
    });

    const presentValues = colorValues.filter((v): v is number => v !== null && Number.isFinite(v));
    let total: number | null = null;
    if (presentValues.length > 0) {
      total =
        metric.mode === 'average'
          ? presentValues.reduce((a, b) => a + b, 0) / presentValues.length
          : presentValues.reduce((a, b) => a + b, 0);
    }

    return {
      label: metric.label,
      values: colorValues,
      total,
      percent: metric.percent || false,
    };
  });

  return { colors, metricResults };
}
