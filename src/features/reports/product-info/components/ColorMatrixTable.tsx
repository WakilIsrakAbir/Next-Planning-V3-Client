'use client';

import { formatNumDisplay } from '@/features/reports/product-info/lib/number-format';
import type { ColorMatrixData } from '@/features/reports/product-info/types';

/** TAB 2: COLOR-WISE SPECIFICATION MATRIX (EXP STANDARD) */
export default function ColorMatrixTable({ matrixData }: { matrixData: ColorMatrixData }) {
  return (
    <div className="rounded-lg border border-base-300 overflow-hidden bg-base-100 shadow-xs">
      {matrixData.colors.length === 0 ? (
        <div className="p-6 text-center text-xs text-base-content/50">
          No color-wise breakdown available for this order.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-xs w-full text-center">
            <thead className="bg-base-200 text-[10px] uppercase font-extrabold tracking-wider">
              <tr>
                <th className="text-left w-[180px]">Metric / Department</th>
                {matrixData.colors.map((c) => (
                  <th key={c.key} className="text-center font-bold">
                    {c.label}
                  </th>
                ))}
                <th className="text-center bg-primary/10 text-primary font-black">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-200 font-mono text-xs">
              {matrixData.metricResults.map((m, idx) => (
                <tr key={idx} className="hover">
                  <td className="font-sans font-bold text-left bg-base-200/30 text-xs">
                    {m.label}
                  </td>
                  {m.values.map((v, cIdx) => (
                    <td key={cIdx} className="text-center">
                      {v === null ? (
                        <span className="text-base-content/30">0</span>
                      ) : (
                        formatNumDisplay(v, m.percent)
                      )}
                    </td>
                  ))}
                  <td className="text-center font-black bg-primary/5 text-primary">
                    {m.total === null ? (
                      <span className="text-base-content/30">0</span>
                    ) : (
                      formatNumDisplay(m.total, m.percent)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
