'use client';

import type { ReactNode, RefObject } from 'react';
import { FileText } from 'lucide-react';

interface PPIReportSheetProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  sizerRef: RefObject<HTMLDivElement | null>;
  sheetRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

/** Report viewport (scrolls sideways when zoomed in), the zoom sizer and the report sheet with its title. */
export default function PPIReportSheet({ viewportRef, sizerRef, sheetRef, children }: PPIReportSheetProps) {
  return (
    <div ref={viewportRef} className="w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-1">
      <div ref={sizerRef} className="mx-auto">
        <div
          ref={sheetRef}
          className="w-full origin-top-left transition-transform duration-150 ease-out bg-base-100 rounded-xl shadow-xs border border-base-300 p-3 sm:p-6 space-y-6"
        >
          {/* Report Screen Title */}
          <div className="pb-3 border-b border-base-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">Detailed Planning & Production Info</h2>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
