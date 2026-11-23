'use client';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ProductInfoSummaryCard from '@/features/reports/product-info/components/ProductInfoSummaryCard';
import ProductInfoDetailTabs from '@/features/reports/product-info/components/ProductInfoDetailTabs';
import FabricBreakdownTable from '@/features/reports/product-info/components/FabricBreakdownTable';
import ColorMatrixTable from '@/features/reports/product-info/components/ColorMatrixTable';
import type { ColorMatrixData, ProductInfoOrder, ProductInfoTab } from '@/features/reports/product-info/types';

interface ProductInfoOrderDetailsProps {
  loadingDetails: boolean;
  orderDetails: ProductInfoOrder;
  activeTab: ProductInfoTab;
  setActiveTab: (tab: ProductInfoTab) => void;
  fabricItems: ProductInfoOrder[];
  matrixData: ColorMatrixData;
  handleDownloadExcel: () => void;
}

/** An expanded order's specifications: summary card, view tabs and the selected tab's table. */
export default function ProductInfoOrderDetails({
  loadingDetails,
  orderDetails,
  activeTab,
  setActiveTab,
  fabricItems,
  matrixData,
  handleDownloadExcel,
}: ProductInfoOrderDetailsProps) {
  return (
    <>
      {loadingDetails ? (
        <div className="flex py-6 justify-center">
          <LoadingSpinner message="Loading Order Specifications..." size="sm" overlay={false} />
        </div>
      ) : orderDetails ? (
        <div className="space-y-4">
          {/* Top Info Card with Action Buttons */}
          <ProductInfoSummaryCard orderDetails={orderDetails} handleDownloadExcel={handleDownloadExcel} />

          {/* View Switcher Tabs */}
          <ProductInfoDetailTabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            fabricItems={fabricItems}
            matrixData={matrixData}
          />

          {/* TAB 1: FABRIC & COLOR BREAKDOWN (ITEM LEVEL) */}
          {activeTab === 'breakdown' && <FabricBreakdownTable fabricItems={fabricItems} />}

          {/* TAB 2: COLOR-WISE SPECIFICATION MATRIX (EXP STANDARD) */}
          {activeTab === 'matrix' && <ColorMatrixTable matrixData={matrixData} />}
        </div>
      ) : (
        <p className="text-xs text-base-content/50">No detailed specs available.</p>
      )}
    </>
  );
}
