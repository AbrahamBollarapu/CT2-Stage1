import React from "react";


interface HeroProps {
onGoLive?: () => void;
ingesting?: boolean;
sent?: number;
}


const Hero: React.FC<HeroProps> = ({ onGoLive, ingesting, sent = 0 }) => {
return (
<section className="card p-6 md:p-8 mb-6">
<div className="flex flex-col md:flex-row md:items-center md:justify-between gx-hero">
<div>
<h1 className="h-hero text-[color:var(--ink)]">CogTechAI — Live Grid Telemetry</h1>
<p className="h-sub mt-2">Real‑time ingest → clean KPIs → investor‑ready visuals. Stage‑1 baseline is green.</p>
</div>
<div className="flex items-center gap-3 mt-4 md:mt-0">
<button className="btn" onClick={onGoLive} disabled={!!ingesting}>
{ingesting ? "Streaming…" : "Go Live"}
</button>
<span className="h-sub">SENT: <strong>{sent}</strong></span>
</div>
</div>
</section>
);
};


export default Hero;