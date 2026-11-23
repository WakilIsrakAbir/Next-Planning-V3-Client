'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { sharedRequest } from '@/lib/shared-request';
import { pageForNewLimit, useFitRows } from '@/hooks/use-fit-rows';
import { cachedProductInfo, lastListRequest } from '@/features/reports/product-info/lib/product-info-cache';
import { ROW_HEIGHT, SEARCH_DEBOUNCE_MS } from '@/features/reports/product-info/lib/constants';
import { computeColorMatrix } from '@/features/reports/product-info/lib/color-matrix';
import { downloadProductInfoExcel } from '@/features/reports/product-info/lib/product-info-excel';
import ProductInfoHeader from '@/features/reports/product-info/components/ProductInfoHeader';
import ProductInfoSearchBar from '@/features/reports/product-info/components/ProductInfoSearchBar';
import ProductInfoOrdersTable from '@/features/reports/product-info/components/ProductInfoOrdersTable';
import ProductInfoOrderDetails from '@/features/reports/product-info/components/ProductInfoOrderDetails';

export default function ProductInfoScreen() {
  const initialCacheKey = `1_${lastListRequest.limit}_`;
  const initialCache = cachedProductInfo.data.get(initialCacheKey);

  const [orders, setOrders] = useState<any[]>(() => initialCache?.orders || []);
  const [loading, setLoading] = useState(() => !initialCache);
  const [search, setSearch] = useState('');
  // Search text actually requested: follows `search` after a typing pause, or at once on Enter
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limitChoice, setLimitChoice] = useState<number | 'auto'>('auto');
  // The table area: "Auto" shows as many rows as fit in it, so the page neither scrolls nor leaves an empty band
  const scrollRef = useRef<HTMLDivElement>(null);
  const fit = useFitRows(scrollRef, ROW_HEIGHT);
  const limit = limitChoice === 'auto' ? (fit?.rows ?? null) : limitChoice;
  const [totalPages, setTotalPages] = useState(() => initialCache?.totalPages || 1);
  const [totalCount, setTotalCount] = useState(() => initialCache?.total || 0);

  // Expanded row details
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'matrix'>('breakdown');

  // Only the newest list / detail request may update the screen (responses can arrive out of order)
  const latestRequestRef = useRef(0);
  const latestDetailRef = useRef(0);

  // Debounced search: one request after the user stops typing instead of one per keystroke
  useEffect(() => {
    if (search === appliedSearch) return;
    const timer = window.setTimeout(() => {
      setAppliedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, appliedSearch]);

  // When "Auto" fits a different number of rows (window or sidebar resized), keep the first visible row in view
  const [prevLimit, setPrevLimit] = useState(limit);
  if (limit !== prevLimit) {
    setPrevLimit(limit);
    if (limitChoice === 'auto' && prevLimit && limit) setPage(pageForNewLimit(page, prevLimit, limit));
  }

  const fetchOrders = async (bypassCache = false) => {
    // "Auto" waits until the table area has been measured
    if (limit === null) return;
    lastListRequest.limit = limit;
    const cacheKey = `${page}_${limit}_${appliedSearch.trim().toLowerCase()}`;
    if (!bypassCache) {
      const cached = cachedProductInfo.data.get(cacheKey);
      if (cached) {
        setOrders(cached.orders);
        setTotalCount(cached.total);
        setTotalPages(cached.totalPages);
        setLoading(false);
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    const requestId = ++latestRequestRef.current;
    try {
      const endpoint = `/api/orders/all-list?page=${page}&limit=${limit}&search=${encodeURIComponent(appliedSearch)}`;
      const res = await sharedRequest(
        endpoint,
        () =>
          apiClient<{
            orders: any[];
            total: number;
            totalPages: number;
          }>(endpoint),
        bypassCache
      );
      const result = {
        orders: res.orders || [],
        total: res.total || 0,
        totalPages: res.totalPages || 1,
      };
      cachedProductInfo.data.set(cacheKey, result);
      // A newer request (page / search change) owns the table now
      if (requestId !== latestRequestRef.current) return;
      setOrders(result.orders);
      setTotalCount(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('Failed to fetch product info orders:', err);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Refetch only when the page or the applied (debounced / Enter) search changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, appliedSearch]);

  const handleLimitChange = (newLimit: number | 'auto') => {
    setLimitChoice(newLimit);
    setPage(1);
  };

  // At most one page of rows (the previous page's rows are cut while a smaller page loads); "Auto" rows fill the table area
  const visibleOrders = limit ? orders.slice(0, limit) : orders;
  const rowStyle = limitChoice === 'auto' && fit ? { height: fit.rowHeight } : undefined;

  const applySearchNow = () => {
    setAppliedSearch(search);
    setPage(1);
  };

  const toggleExpand = async (orderNo: string) => {
    const requestId = ++latestDetailRef.current;
    if (expandedOrder === orderNo) {
      setExpandedOrder(null);
      setOrderDetails(null);
      return;
    }

    setExpandedOrder(orderNo);
    const cached = cachedProductInfo.details.get(orderNo);
    if (cached) {
      setOrderDetails(cached);
      setLoadingDetails(false);
    } else {
      setLoadingDetails(true);
    }

    try {
      const res = await apiClient<{ order: any }>(`/api/orders/${encodeURIComponent(orderNo)}?dept=knitting`);
      const order = res.order || null;
      if (order) {
        cachedProductInfo.details.set(orderNo, order);
      }
      // Another row was expanded / collapsed meanwhile: do not show this order's specs there
      if (requestId !== latestDetailRef.current) return;
      setOrderDetails(order);
    } catch (err) {
      console.error('Failed to load order specs:', err);
    } finally {
      if (requestId === latestDetailRef.current) setLoadingDetails(false);
    }
  };

  // Get active items list for itemized fabric table
  const fabricItems = useMemo(() => {
    if (!orderDetails) return [];
    if (orderDetails.knittingItems && orderDetails.knittingItems.length > 0) {
      return orderDetails.knittingItems;
    }
    if (orderDetails.dyeingItems && orderDetails.dyeingItems.length > 0) {
      return orderDetails.dyeingItems;
    }
    if (orderDetails.deliveryItems && orderDetails.deliveryItems.length > 0) {
      return orderDetails.deliveryItems;
    }
    if (orderDetails.finishingItems && orderDetails.finishingItems.length > 0) {
      return orderDetails.finishingItems;
    }
    return orderDetails.ydItems || [];
  }, [orderDetails]);

  // Compute Color-Wise Specification Matrix (Exp logic)
  const matrixData = useMemo(() => computeColorMatrix(orderDetails), [orderDetails]);

  // Excel download handler
  const handleDownloadExcel = () => {
    if (!orderDetails) return;
    downloadProductInfoExcel(orderDetails, matrixData, fabricItems);
  };

  return (
    // The page fills the content area: the header, the search and the pagination stay put, only the table rows scroll
    // (an expanded order's specifications scroll with them).
    <div className="flex h-full min-h-0 w-full flex-col gap-6">
      {/* Header */}
      <ProductInfoHeader onRefresh={() => fetchOrders(true)} />

      {/* Control Card */}
      <ProductInfoSearchBar search={search} setSearch={setSearch} applySearchNow={applySearchNow} totalCount={totalCount} />

      {/* Order List Table */}
      <ProductInfoOrdersTable
        loading={loading}
        scrollRef={scrollRef}
        visibleOrders={visibleOrders}
        rowStyle={rowStyle}
        expandedOrder={expandedOrder}
        toggleExpand={toggleExpand}
        expandedDetails={
          <ProductInfoOrderDetails
            loadingDetails={loadingDetails}
            orderDetails={orderDetails}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            fabricItems={fabricItems}
            matrixData={matrixData}
            handleDownloadExcel={handleDownloadExcel}
          />
        }
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        fit={fit}
        setPage={setPage}
        handleLimitChange={handleLimitChange}
        limitChoice={limitChoice}
      />
    </div>
  );
}
