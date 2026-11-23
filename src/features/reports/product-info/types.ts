// The order objects of the API are not typed on this screen (list rows and the order detail)
export type ProductInfoOrder = any;

export type ProductInfoTab = 'breakdown' | 'matrix';

export interface ColorMatrixMetric {
  label: string;
  values: (number | null)[];
  total: number | null;
  percent: boolean;
}

export interface ColorMatrixData {
  colors: { key: string; label: string }[];
  metricResults: ColorMatrixMetric[];
}
