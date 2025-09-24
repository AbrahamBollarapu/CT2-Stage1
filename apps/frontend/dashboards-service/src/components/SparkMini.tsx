import React, { useMemo } from "react";

type Pt = { ts: string; value: number };

export default function SparkMini({
  data,
  width = 120,
  height = 32,
  className = "text-app-primary",
}: {
  data: Pt[];
  width?: number;
  height?: number;
  className?: string; // controls stroke/fill via text- class
}) {
  const pad = 2;

  const { d, last } = useMemo(() => {
    const pts = (data ?? []).slice().sort((a,b)=>a.ts.localeCompare(b.ts));
    if (!pts.length) return { d: "", last: null as { x:number; y:number } | null };

    const xs = pts.map(p=>new Date(p.ts).getTime());
    const ys = pts.map(p=>p.value);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const spanX = Math.max(1, xMax - xMin);
    const spanY = Math.max(1e-9, yMax - yMin);

    const sx = (t:number)=> ((t - xMin)/spanX)*(width - pad*2) + pad;
    const sy = (y:number)=> height - (((y - yMin)/spanY)*(height - pad*2) + pad);

    const norm = pts.map(p=>({ x: sx(new Date(p.ts).getTime()), y: sy(p.value) }));
    const d = norm.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const last = norm[norm.length-1];
    return { d, last };
  }, [data, width, height]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`w-[${width}px] h-[${height}px] ${className}`}>
      <path d={d} stroke="currentColor" strokeWidth="2" fill="none" />
      {last && <circle cx={last.x} cy={last.y} r="2.5" className="fill-current" />}
    </svg>
  );
}
