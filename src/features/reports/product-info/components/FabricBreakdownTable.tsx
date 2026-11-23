'use client';

import { getColData } from '@/lib/data-utils';
import { formatNumDisplay, parseNum } from '@/features/reports/product-info/lib/number-format';
import type { ProductInfoOrder } from '@/features/reports/product-info/types';

/** TAB 1: FABRIC & COLOR BREAKDOWN (ITEM LEVEL) */
export default function FabricBreakdownTable({ fabricItems }: { fabricItems: ProductInfoOrder[] }) {
  return (
    <div className="rounded-lg border border-base-300 overflow-hidden bg-base-100 shadow-xs">
      <div className="overflow-x-auto">
        <table className="table table-xs w-full text-center">
          <thead className="bg-base-200 text-[10px] uppercase font-extrabold tracking-wider">
            <tr>
              <th className="text-left">Color</th>
              <th className="text-left">Fabric Construction</th>
              <th>GSM</th>
              <th>Dia</th>
              <th>Req Qty (kg)</th>
              <th>Allowance %</th>
              <th>Yarn Req</th>
              <th>Allocated Qty</th>
              <th>Yarn Bala</th>
              <th className="bg-primary/10 text-primary">Grey Req</th>
              <th className="bg-success/10 text-success">Knit Prod</th>
              <th className="bg-primary/10 text-primary">Knit Bala</th>
              <th>Deli Bala</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200">
            {fabricItems.map((it: any, idx: number) => {
              const color = getColData(it, ['Color', 'Colour', 'Fab Color']) || '—';
              const construction =
                getColData(it, ['FabricConstruction', 'Construction', 'Fabric']) || '—';
              const gsm = getColData(it, ['GSM', 'G.S.M', 'Finish GSM', 'Body GSM']) || '—';
              const dia =
                getColData(it, ['Gauge-Dia', 'Dia', 'Finish Dia', 'Grey Dia', 'Dia / Width', 'Width']) || '—';
              const reqQty = getColData(it, ['RequiredQtyKgs', 'Required Qty', 'Req Qty', 'Qty']);
              const allowance = getColData(it, ['Allowance %', 'Allowance', 'Allow']);
              const yarnReq = getColData(it, ['Yarn req.', 'Yarn Req', 'YarnReq']);
              const allocQty = getColData(it, ['Allocated Qty ', 'Allocated Qty', 'AllocatedQty']);
              const yarnBala = getColData(it, ['Yarn bala.', 'Yarn Bala', 'YarnBala']);
              const greyReq = getColData(it, ['Grey Req.', 'Grey Req', 'GreyReq']);
              const knitProd = getColData(it, ['Knit Prod.', 'Knit Prod', 'KnitProd']);
              const knitBala = getColData(it, [
                'Knit. Bala.',
                'Knit Bala',
                'KnitBala',
                'Knit Balance',
                'Knit. Bal.',
              ]);
              const deliBala = getColData(it, ['Deli. Bala.', 'Deli. Bal.', 'DeliBal', 'Delivery Balance']);

              return (
                <tr key={idx} className="hover">
                  <td className="font-bold text-left">{color}</td>
                  <td className="text-left">{construction}</td>
                  <td className="font-mono">{gsm}</td>
                  <td className="font-mono">{dia}</td>
                  <td className="font-mono font-bold">{formatNumDisplay(reqQty)}</td>
                  <td className="font-mono">{formatNumDisplay(allowance, true)}</td>
                  <td className="font-mono">{formatNumDisplay(yarnReq)}</td>
                  <td className="font-mono">{formatNumDisplay(allocQty)}</td>
                  <td className="font-mono">{formatNumDisplay(yarnBala)}</td>
                  <td className="font-mono font-bold bg-primary/5 text-primary">
                    {formatNumDisplay(greyReq)}
                  </td>
                  <td className="font-mono font-bold bg-success/5 text-success">
                    {formatNumDisplay(knitProd)}
                  </td>
                  <td className="font-mono font-bold bg-primary/5 text-primary">
                    {formatNumDisplay(knitBala)}
                  </td>
                  <td className="font-mono font-semibold">{formatNumDisplay(deliBala)}</td>
                </tr>
              );
            })}
          </tbody>
          {/* Total Summary Footer */}
          {fabricItems.length > 1 && (
            <tfoot className="bg-base-200/70 font-extrabold text-[11px]">
              <tr>
                <td colSpan={4} className="text-right uppercase">
                  Total:
                </td>
                <td className="font-mono text-center">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['RequiredQtyKgs', 'Required Qty', 'Req Qty'])) || 0),
                      0
                    )
                  )}
                </td>
                <td>—</td>
                <td className="font-mono text-center">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['Yarn req.', 'Yarn Req'])) || 0),
                      0
                    )
                  )}
                </td>
                <td className="font-mono text-center">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['Allocated Qty ', 'Allocated Qty'])) || 0),
                      0
                    )
                  )}
                </td>
                <td className="font-mono text-center">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['Yarn bala.', 'Yarn Bala'])) || 0),
                      0
                    )
                  )}
                </td>
                <td className="font-mono text-center text-primary bg-primary/10">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['Grey Req.', 'Grey Req'])) || 0),
                      0
                    )
                  )}
                </td>
                <td className="font-mono text-center text-success bg-success/10">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['Knit Prod.', 'Knit Prod'])) || 0),
                      0
                    )
                  )}
                </td>
                <td className="font-mono text-center text-primary bg-primary/10">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['Knit. Bala.', 'Knit Bala'])) || 0),
                      0
                    )
                  )}
                </td>
                <td className="font-mono text-center">
                  {formatNumDisplay(
                    fabricItems.reduce(
                      (acc: number, it: any) =>
                        acc + (parseNum(getColData(it, ['Deli. Bala.', 'Deli. Bal.'])) || 0),
                      0
                    )
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
