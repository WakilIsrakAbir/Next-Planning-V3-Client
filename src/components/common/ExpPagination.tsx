'use client';

import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ExpPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  limitOptions?: number[];
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

export default function ExpPagination({
  currentPage,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
}: ExpPaginationProps) {
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

  const handleLimitChange = (newLimit: number) => {
    onLimitChange(newLimit);
    scrollToPageTop();
  };

  return (
    <div
      id="paginationControls"
      className="bg-white border-t border-gray-300 p-2 md:px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-700 shrink-0 gap-3"
    >
      {/* Left: Rows per page and Showing count */}
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          id="rowsPerPage"
          value={limit}
          onChange={(e) => handleLimitChange(Number(e.target.value))}
          className="border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-gray-50 text-gray-800 cursor-pointer text-xs"
        >
          {limitOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
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
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 cursor-pointer shadow-xs'
          }`}
        >
          <ChevronLeft className="h-3 w-3 mr-1 inline-block" /> Prev
        </button>

        <span className="px-3 py-1 font-semibold text-gray-700 hidden sm:inline-block">
          Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
        </span>

        <button
          disabled={currentPage >= totalPages || totalPages === 0}
          onClick={() => handlePageChange(currentPage + 1)}
          className={`px-3 py-1.5 border rounded font-medium text-xs transition-colors inline-flex items-center ${
            currentPage >= totalPages || totalPages === 0
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 cursor-pointer shadow-xs'
          }`}
        >
          Next <ChevronRight className="h-3 w-3 ml-1 inline-block" />
        </button>
      </div>
    </div>
  );
}

