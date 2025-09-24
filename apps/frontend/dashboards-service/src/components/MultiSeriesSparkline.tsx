import React, { useMemo, useRef, useState } from "react";

export type SeriesPt = { ts: string; value: number };
export type Series = {
  id: string;                 // e.g. "grid_kwh"
  label: string;              // e.g. "kWh"
  colorClass?: string;        // tailwind text- class controlling stroke/fill color (default text-app-primary)
  points: SeriesPt[];
};

function fmtVal(n: number) { return n.toFixed(3); }
function fmtTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function MultiSeriesSparkline({
  series,
  height = 220,
  legend = true,
}: {
  series: Series[];
  height?: number;
  legend?: boolean;
}) {
  const width = 900;
  const pad = 16;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const computed = useMemo(() => {
    // Normalize & sort
    const cleaned = series
      .filter(s => (s.points?.length ?? 0) > 0)
      .map(s => ({
        ...s,
        pts: s.points.slice().sort((a,b) => a.ts.localeCompare(b.ts)),
      }));
    if (!cleaned.length) return null;

    const xs = cleaned.flatMap(s => s.pts.map(p => new Date(p.ts).getTime()));
    const ys = cleaned.flatMap(s => s.pts.map(p => p.value));

    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);

    const spanX = Math.max(1, xMax - xMin);
    const spanY = Math.max(1e-9, yMax - yMin);

    const sx = (t: number) => ((t - xMin) / spanX) * (width - pad*2) + pad;
    const sy = (y: number) => height - (((y - yMin) / spanY) * (height - pad*2) + pad);

    const lines = cleaned.map((s, idx) => {
      const pts = s.pts.map(p => ({
        x: sx(new Date(p.ts).getTime()),
        y: sy(p.value),
        raw: p,
      }));
      const dLine = pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
      const dArea = dLine
        ? `${dLine} L ${pts[pts.length-1].x.toFixed(2)} ${height-pad} L ${pts[0].x.toFixed(2)} ${height-pad} Z`
        : '';
      return {
        id: s.id,
        label: s.label,
        colorClass: s.colorClass || "text-app-primary",
        pts,
        dLine,
        dArea,
        last: s.pts[s.pts.length-1],
        z: idx, // for stable key ordering
      };
    });

    return { lines, xMin, xMax, yMin, yMax, sx, sy };
  }, [series, height]);

  // nearest points for hover
  const hover = useMemo(() => {
    if (!computed || hoverX == null) return null;
    const candidates = computed.lines.map(line => {
      let best = line.pts[0];
      let bestDx = Math.abs(best.x - hoverX);
      for (let i=1;i<line.pts.length;i++){
        const dx = Math.abs(line.pts[i].x - hoverX);
        if (dx < bestDx) { best = line.pts[i]; bestDx = dx; }
      }
      return { id: line.id, label: line.label, colorClass: line.colorClass, pt: best };
    });
    return candidates;
  }, [computed, hoverX]);

  if (!computed) {
    return (
      <div className="relative">
        <div className="h-[220px] rounded-xl bg-white/5 flex items-center justify-center text-app-ink-dim">
          No data yet — Go Live to see streams.
        </div>
      </div>
    );
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverX(Math.min(Math.max(x, pad), rect.width - pad));
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[220px] select-none"
        onMouseMove={onMove}
        onMouseLeave={()=>setHoverX(null)}
      >
        <defs>
          {computed.lines.map((line) => (
            <linearGradient key={line.id} id={`ms-fill-${line.id}`} x1="0" x2="0" y1="0" y2="1">
              {/* we leverage currentColor via CSS class on <path> */}
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
            </linearGradient>
          ))}
          <filter id="ms-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* grid */}
        {Array.from({length:4}).map((_,i)=>{
          const y = ((i+1)/5)*height;
          return <line key={i} x1={16} x2={width-16} y1={y} y2={y} className="stroke-white/5" />
        })}

        {/* areas then lines so lines sit on top */}
        {computed.lines.map(line => (
          <g key={line.id} className={line.colorClass}>
            <path d={line.dArea} fill={`url(#ms-fill-${line.id})`} />
            <path
              d={line.dLine}
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
              filter="url(#ms-glow)"
              style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: "spark-draw 900ms ease-out forwards" }}
            />
          </g>
        ))}

        {/* hover vertical + markers */}
        {hoverX != null && (
          <>
            <line x1={hoverX} x2={hoverX} y1={pad} y2={height - pad} className="stroke-white/10" />
            {hover?.map(h => (
              <circle key={h.id} cx={h.pt.x} cy={h.pt.y} r={4} className={`${h.colorClass} fill-current`} />
            ))}
          </>
        )}
      </svg>

      {/* legend */}
      {legend && (
        <div className="absolute left-4 top-3 flex gap-3">
          {computed.lines.map(l => (
            <div key={l.id} className="flex items-center gap-2 text-xs text-app-ink-dim">
              <span className={`${l.colorClass} inline-block w-2.5 h-2.5 rounded-full bg-current`} />
              <span className="uppercase tracking-wide">{l.label}</span>
              <span className="text-app-ink/70">·</span>
              <span className="text-app-ink">
                {fmtVal(l.last.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* hover tooltip */}
      {hoverX != null && hover && hover.length > 0 && (
        <div
          className="absolute -translate-x-1/2 px-3 py-2 rounded-lg bg-app-card text-app-ink text-xs shadow-soft border border-white/10 space-y-1"
          style={{ left: `${(hoverX/width)*100}%`, top: 8 }}
        >
          {hover.map(h => (
            <div key={h.id} className="flex items-center gap-2">
              <span className={`${h.colorClass} inline-block w-2.5 h-2.5 rounded-full bg-current`} />
              <span className="font-medium">{fmtVal(h.pt.raw.value)}</span>
              <span className="text-app-ink-dim">{fmtTs(h.pt.raw.ts)}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spark-draw { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
