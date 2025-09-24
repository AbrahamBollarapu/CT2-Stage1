import React, { useMemo, useRef, useState } from "react";
export type SeriesPt = { ts:string; value:number };
export type Series = { name:string; points:SeriesPt[]; colorClass?:string };

export function SparkMini({ points, width=120, height=32, colorClass="text-app-primary" }:{ points:SeriesPt[]; width?:number; height?:number; colorClass?:string; }){
  const pad=2;
  const { d, last } = useMemo(()=>{
    const pts=(points??[]).slice().sort((a,b)=>a.ts.localeCompare(b.ts));
    if(!pts.length) return { d:"", last:null as {x:number;y:number}|null };
    const xs=pts.map(p=>new Date(p.ts).getTime()), ys=pts.map(p=>p.value);
    const xMin=Math.min(...xs), xMax=Math.max(...xs), yMin=Math.min(...ys), yMax=Math.max(...ys);
    const spanX=Math.max(1,xMax-xMin), spanY=Math.max(1e-9,yMax-yMin);
    const sx=(t:number)=>((t-xMin)/spanX)*(width-pad*2)+pad;
    const sy=(y:number)=>height-(((y-yMin)/spanY)*(height-pad*2)+pad);
    const norm=pts.map(p=>({x:sx(new Date(p.ts).getTime()), y:sy(p.value)}));
    const d=norm.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return { d, last:norm[norm.length-1] };
  },[points,width,height]);
  return (<svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={colorClass}>
    <path d={d} stroke="currentColor" strokeWidth={2} fill="none" />{last&&<circle cx={last.x} cy={last.y} r={2.5} className="fill-current" />}
  </svg>);
}

function fmtTs(ts:string){ const d=new Date(ts); return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"}); }

export default function Sparkline({ series, height=220, showLegend=true, gradient=true }:{ series:Series[]; height?:number; showLegend?:boolean; gradient?:boolean; }){
  const width=900, pad=16;
  const svgRef=useRef<SVGSVGElement|null>(null);
  const [hoverX,setHoverX]=useState<number|null>(null);

  const computed=useMemo(()=>{
    const cleaned=series.filter(s=>(s.points?.length??0)>0).map(s=>({ ...s, pts:s.points.slice().sort((a,b)=>a.ts.localeCompare(b.ts)) }));
    if(!cleaned.length) return null;
    const xs=cleaned.flatMap(s=>s.pts.map(p=>new Date(p.ts).getTime()));
    const ys=cleaned.flatMap(s=>s.pts.map(p=>p.value));
    const xMin=Math.min(...xs), xMax=Math.max(...xs), yMin=Math.min(...ys), yMax=Math.max(...ys);
    const spanX=Math.max(1,xMax-xMin), spanY=Math.max(1e-9,yMax-yMin);
    const sx=(t:number)=>((t-xMin)/spanX)*(width-pad*2)+pad;
    const sy=(y:number)=>height-(((y-yMin)/spanY)*(height-pad*2)+pad);
    const lines=cleaned.map(s=>{
      const pts=s.pts.map(p=>({x:sx(new Date(p.ts).getTime()), y:sy(p.value), raw:p}));
      const dLine=pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
      const dArea=dLine?`${dLine} L ${pts[pts.length-1].x.toFixed(2)} ${height-pad} L ${pts[0].x.toFixed(2)} ${height-pad} Z`:"";
      return { id:s.name, label:s.name, colorClass:s.colorClass||"text-app-primary", pts, dLine, dArea, last:s.pts[s.pts.length-1] };
    });
    return { lines };
  },[series,height]);

  const hover=useMemo(()=>{
    if(!computed||hoverX==null) return null;
    return computed.lines.map(line=>{
      let best=line.pts[0], bestDx=Math.abs(best.x-hoverX);
      for(let i=1;i<line.pts.length;i++){ const dx=Math.abs(line.pts[i].x-hoverX); if(dx<bestDx){ best=line.pts[i]; bestDx=dx; } }
      return { id:line.id, label:line.label, colorClass:line.colorClass, pt:best };
    });
  },[computed,hoverX]);

  if(!computed){ return <div className="spark-wrap"><div className="spark-empty">No data yet — Go Live to see streams.</div></div>; }

  const onMove=(e:React.MouseEvent<SVGSVGElement>)=>{
    if(!svgRef.current) return;
    const rect=svgRef.current.getBoundingClientRect();
    setHoverX(Math.min(Math.max(e.clientX-rect.left, pad), rect.width-pad));
  };

  return (<div className="relative">
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-[220px] select-none" onMouseMove={onMove} onMouseLeave={()=>setHoverX(null)}>
      <defs>
        {gradient && computed.lines.map(line=>(
          <linearGradient key={line.id} id={`spark-fill-${line.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
          </linearGradient>
        ))}
        <filter id="spark-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {Array.from({length:4}).map((_,i)=>(<line key={i} x1={16} x2={width-16} y1={((i+1)/5)*height} y2={((i+1)/5)*height} className="stroke-white/5" />))}
      {computed.lines.map(line=>(
        <g key={line.id} className={line.colorClass}>
          {gradient && <path d={line.dArea} fill={`url(#spark-fill-${line.id})`} />}
          <path d={line.dLine} stroke="currentColor" strokeWidth={2} fill="none" filter="url(#spark-glow)"
            style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: "spark-draw 900ms ease-out forwards" }} />
        </g>
      ))}
      {hoverX!=null && (<>
        <line x1={hoverX} x2={hoverX} y1={16} y2={height-16} className="stroke-white/10" />
        {hover?.map(h=>(<circle key={h.id} cx={h.pt.x} cy={h.pt.y} r={4} className={`${h.colorClass} fill-current`} />))}
      </>)}
    </svg>
    {showLegend && (<div className="absolute left-4 top-3 flex gap-3">
      {computed.lines.map(l=> (
        <div key={l.id} className="flex items-center gap-2 text-xs text-app-ink-dim">
          <span className={`${l.colorClass} inline-block w-2.5 h-2.5 rounded-full bg-current`} />
          <span className="uppercase tracking-wide">{l.label}</span>
          <span className="text-app-ink/70">·</span>
          <span className="text-app-ink">{l.last.value.toFixed(3)}</span>
        </div>
      ))}
    </div>)}
    <style>{`@keyframes spark-draw{to{stroke-dashoffset:0}}`}</style>
  </div>);
}
