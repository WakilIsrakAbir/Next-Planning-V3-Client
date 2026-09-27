'use client';

import React from 'react';
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

  return (
    <div
      id="paginationControls"
      className="bg-white dark:bg-[#1e2330] border-t border-gray-300 dark:border-gray-700 p-2 md:px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-700 dark:text-gray-300 shrink-0 gap-3"
    >
      {/* Left: Rows per page and Showing count */}
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          id="rowsPerPage"
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:border-blue-400 bg-gray-50 dark:bg-[#151921] text-gray-800 dark:text-gray-200 cursor-pointer text-xs"
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
          onClick={() => onPageChange(currentPage - 1)}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded font-medium text-xs transition-colors inline-flex items-center ${
            currentPage <= 1
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 dark:bg-[#151921] dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer'
          }`}
        >
          <ChevronLeft className="h-3 w-3 mr-1 inline-block" /> Prev
        </button>

        <span className="px-3 py-1 font-semibold text-gray-700 dark:text-gray-300 hidden sm:inline-block">
          Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
        </span>

        <button
          disabled={currentPage >= totalPages || totalPages === 0}
          onClick={() => onPageChange(currentPage + 1)}
          className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded font-medium text-xs transition-colors inline-flex items-center ${
            currentPage >= totalPages || totalPages === 0
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              : 'bg-white hover:bg-gray-50 dark:bg-[#151921] dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer'
          }`}
        >
          Next <ChevronRight className="h-3 w-3 ml-1 inline-block" />
        </button>
      </div>
    </div>
  );
}

