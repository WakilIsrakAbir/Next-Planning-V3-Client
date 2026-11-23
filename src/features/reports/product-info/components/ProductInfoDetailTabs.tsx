'use client';

import { Palette, Table as TableIcon } from 'lucide-react';
import type { ColorMatrixData, ProductInfoOrder, ProductInfoTab } from '@/features/reports/product-info/types';

interface ProductInfoDetailTabsProps {
  activeTab: ProductInfoTab;
  setActiveTab: (tab: ProductInfoTab) => void;
  fabricItems: ProductInfoOrder[];
  matrixData: ColorMatrixData;
}

/** View Switcher Tabs */
export default function ProductInfoDetailTabs({ activeTab, setActiveTab, fabricItems, matrixData }: ProductInfoDetailTabsProps) {
  return (
    <div className="flex items-center gap-2 border-b border-base-300 pb-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setActiveTab('breakdown');
        }}
        className={`btn btn-xs gap-1.5 ${
          activeTab === 'breakdown' ? 'btn-primary text-white font-bold' : 'btn-ghost'
        }`}
      >
        <TableIcon className="h-3.5 w-3.5" />
        Fabric & Color Breakdown ({fabricItems.length} items)
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setActiveTab('matrix');
        }}
        className={`btn btn-xs gap-1.5 ${
          activeTab === 'matrix' ? 'btn-primary text-white font-bold' : 'btn-ghost'
        }`}
      >
        <Palette className="h-3.5 w-3.5" />
        Color-wise Specification Matrix ({matrixData.colors.length} colors)
      </button>
    </div>
  );
}
