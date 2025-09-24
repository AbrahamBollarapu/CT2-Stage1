import React, { useMemo, useRef, useState } from "react";

type Pt = { ts: string; value: number };

function fmtVal(n: number) {
  return `${n.toFixed(3)} kWh`;
}
function fmtTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Sparkline({
  data,
  height = 200,
}: {
  data: Pt[];
  height?: number;
}) {
  const width = 820; // viewBox width (element is responsive via CSS)
  const pad = 14;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const {
    points, // normalized & sorted
    dLine,
    dArea,
    xMin,
    xMax,
    yMin,
    yMax,
    last,
  } = useMemo(() => {
    const pts = (data ?? []).slice().sort((a, b) => a.ts.localeCompare(b.ts));
    if (!pts.length) {
      return {
        points: [] as { x: number; y: number; raw: Pt }[],
        dLine: "",
        dArea: "",
        xMin: 0,
        xMax: 1,
        yMin: 0,
        yMax: 1,
        last: null as Pt | null,
      };
    }

    const xs = pts.map((p) => new Date(p.ts).getTime());
    const ys = pts.map((p) => p.value);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const spanX = Math.max(1, xMax - xMin);
    const spanY = Math.max(1e-9, yMax - yMin);

    const sx = (t: number) => ((t - xMin) / spanX) * (width - pad * 2) + pad;
    const sy = (y: number) => height - (((y - yMin) / spanY) * (height - pad * 2) + pad);

    const norm = pts.map((p) => ({
      x: sx(new Date(p.ts).getTime()),
      y: sy(p.value),
      raw: p,
    }));

    const line = norm.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
    const area = line
      ? `${line} L ${norm[norm.length - 1].x.toFixed(2)} ${height - pad} L ${norm[0].x.toFixed(2)} ${height - pad} Z`
      : "";

    return {
      points: norm,
      dLine: line,
      dArea: area,
      xMin,
      xMax,
      yMin,
      yMax,
      last: pts[pts.length - 1],
    };
  }, [data, height]);

  const hasData = points.length > 0;

  // nearest point from mouse X
  const hover = useMemo(() => {
    if (!hasData || hoverX == null) return null;
    let best = points[0];
    let bestDx = Math.abs(points[0].x - hoverX);
    for (let i = 1; i < points.length; i++) {
      const dx = Math.abs(points[i].x - hoverX);
      if (dx < bestDx) {
        best = points[i];
        bestDx = dx;
      }
    }
    return best;
  }, [hoverX, points, hasData]);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverX(Math.min(Math.max(x, pad), rect.width - pad));
  };
  const onLeave = () => setHoverX(null);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[200px] select-none"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <defs>
          {/* line gradient */}
          <linearGradient id="spark-line" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" />
            <stop offset="100%" stopColor="currentColor" />
          </linearGradient>
          {/* area gradient (subtle) */}
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
          </linearGradient>
          {/* soft glow under line */}
          <filter id="spark-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Horizontal grid (subtle) */}
        {Array.from({ length: 4 }).map((_, i) => {
          const y = ((i + 1) / 5) * height;
          return (
            <line
              key={i}
              x1={pad}
              x2={width - pad}
              y1={y}
              y2={y}
              className="stroke-white/5"
            />
          );
        })}

        {/* Area fill */}
        {hasData && (
          <path
            d={dArea}
            fill="url(#spark-fill)"
            className="text-app-primary"
          />
        )}

        {/* Line with subtle draw animation */}
        {hasData && (
          <path
            d={dLine}
            stroke="url(#spark-line)"
            className="text-app-primary"
            strokeWidth={2}
            fill="none"
            filter="url(#spark-glow)"
            style={{
              strokeDasharray: 1000,
              strokeDashoffset: 1000,
              animation: "spark-draw 900ms ease-out forwards",
            }}
          />
        )}

        {/* Hover line & marker */}
        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={pad}
              y2={height - pad}
              className="stroke-white/10"
            />
            <circle cx={hover.x} cy={hover.y} r={4} className="fill-app-primary" />
          </>
        )}
      </svg>

      {/* Last value chip (pinned to top-right) */}
      {hasData && last && (
        <div className="absolute right-4 top-3 text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-app-ink">
          {fmtVal(last.value)}
        </div>
      )}

      {/* Tooltip */}
      {hover && (
        <div
          className="absolute -translate-x-1/2 -translate-y-3 px-2 py-1 rounded-lg bg-app-card text-app-ink text-xs shadow-soft border border-white/10"
          style={{ left: `${(hover.x / width) * 100}%`, top: 8 }}
        >
          <div className="font-medium">{fmtVal(hover.raw.value)}</div>
          <div className="text-app-ink-dim">{fmtTs(hover.raw.ts)}</div>
        </div>
      )}

      {/* Empty-state overlay */}
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-app-ink-dim text-sm">
          No data yet — click <span className="mx-1 font-semibold">Go Live</span> to start the stream.
        </div>
      )}

      {/* Keyframes (scoped) */}
      <style>
        {`
          @keyframes spark-draw {
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>
    </div>
  );
}
