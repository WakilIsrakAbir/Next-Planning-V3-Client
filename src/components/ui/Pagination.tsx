'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  /** Rows per page in use (the fitted row count while "Auto" is selected). */
  limit: number;
  onPageChange: (newPage: number) => void;
  /** A number of rows, or 'auto' for as many rows as fit on the screen. */
  onLimitChange: (newLimit: number | 'auto') => void;
  limitOptions?: number[];
  /** Rows that fit on the screen; when given, an "Auto" option is offered. */
  autoRows?: number | null;
  /** Whether "Auto" is the selected page size. */
  isAuto?: boolean;
  /** When given, an "All" option (every row on one page) is offered; called when it is chosen. */
  onShowAll?: () => void;
  /** Whether "All" is the selected page size. */
  isAll?: boolean;
}

export function scrollToPageTop() {
  if (typeof window === 'undefined') return;

  // 1. Scroll main dashboard container
  const mainEl = document.querySelector('main');
  if (mainEl) {
    mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 2. Scroll window to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // 3. Scroll all internal table wrappers
  const scrollContainers = document.querySelectorAll('.overflow-x-auto, .custom-scrollbar, #dataTableContentWrapper');
  scrollContainers.forEach((el) => {
    if (el !== mainEl) {
      el.scrollTop = 0;
    }
  });

  // 4. Scroll table card into view if needed
  const table = document.querySelector('table');
  if (table) {
    const card = table.closest('.card') || table;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
  autoRows,
  isAuto = false,
  onShowAll,
  isAll = false,
}: PaginationProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, totalItems);
  const isFirstRender = useRef(true);

  // Automatically scroll to top whenever page changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scrollToPageTop();
  }, [currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || (totalPages > 0 && newPage > totalPages) || newPage === currentPage) return;
    onPageChange(newPage);
    scrollToPageTop();
  };

  const handleLimitChange = (value: string) => {
    if (value === 'all') onShowAll?.();
    else onLimitChange(value === 'auto' ? 'auto' : Number(value));
    scrollToPageTop();
  };

  return (
    <div
      id="paginationControls"
      className="bg-white border-t border-gray-300 p-2 md:px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-700 shrink-0 gap-3 dark:bg-[#181c25] dark:border-[#2a3346] dark:text-[#cbd5e1]"
    >
      {/* Left: Rows per page and Showing count */}
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          id="rowsPerPage"
          value={isAll ? 'all' : isAuto ? 'auto' : limit}
          onChange={(e) => handleLimitChange(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-emerald-400 bg-gray-50 text-gray-800 cursor-pointer text-xs dark:bg-[#1e2330] dark:text-[#e2e8f0] dark:border-[#2a3346]"
        >
          {autoRows ? <option value="auto">Auto ({autoRows})</option> : null}
          {limitOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          {onShowAll ? <option value="all">All</option> : null}
        </select>
        <span id="pageInfo" className="ml-2 font-medium">
          Showing {totalItems === 0 ? '0-0 of 0' : `${start}-${end} of ${totalItems.toLocaleString()}`}
        </span>
      </div>

      {/* Right: Prev, Page X of Y, Next */}
      <div className="flex items-center gap-1" id="pageButtons">
        <button
          disabled={currentPage <= 1}
          onClick={() => handlePageChange(currentPage - 1)}
          className={`px-3 py-1.5 border rounded font-medium text-xs transition-colors inline-flex items-center ${
            currentPage <= 1
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-[#151921] dark:text-gray-500 dark:border-[#1e2536]'
              : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 cursor-pointer shadow-xs dark:bg-[#1e2330] dark:hover:bg-[#252b3b] dark:text-[#cbd5e1] dark:border-[#2a3346]'
          }`}
        >
          <ChevronLeft className="h-3 w-3 mr-1 inline-block" /> Prev
        </button>

        <span className="px-3 py-1 font-semibold text-gray-700 hidden sm:inline-block dark:text-[#cbd5e1]">
          Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
        </span>

        <button
          disabled={currentPage >= totalPages || totalPages === 0}
          onClick={() => handlePageChange(currentPage + 1)}
          className={`px-3 py-1.5 border rounded font-medium text-xs transition-colors inline-flex items-center ${
            currentPage >= totalPages || totalPages === 0
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-[#151921] dark:text-gray-500 dark:border-[#1e2536]'
              : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 cursor-pointer shadow-xs dark:bg-[#1e2330] dark:hover:bg-[#252b3b] dark:text-[#cbd5e1] dark:border-[#2a3346]'
          }`}
        >
          Next <ChevronRight className="h-3 w-3 ml-1 inline-block" />
        </button>
      </div>
    </div>
  );
}

