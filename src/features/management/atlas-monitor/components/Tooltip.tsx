'use client';

import { useEffect, useRef, useState } from 'react';
import type { TipState } from '@/features/management/atlas-monitor/types';

// ---------- tooltip ----------
export function Tooltip({ tip }: { tip: TipState | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!tip || !ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    let left = tip.x + 14;
    let top = tip.y - h - 10;
    if (left + w > window.innerWidth - 8) left = tip.x - w - 14;
    if (top < 8) top = tip.y + 16;
    setPos({ left: Math.max(8, left), top });
  }, [tip]);
  if (!tip) return null;
  return (
    <div ref={ref} role="status" className="am-tip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
      {tip.title && <div className="am-tip-l">{tip.title}</div>}
      {tip.rows.map((r, i) => (
        <div key={i} className="am-tip-row">
          {r.color && <span className="am-key" style={{ background: `var(${r.color})` }} />}
          <span className="am-tip-v">{r.value}</span>
          {r.label && <span className="am-tip-l">{r.label}</span>}
        </div>
      ))}
    </div>
  );
}
