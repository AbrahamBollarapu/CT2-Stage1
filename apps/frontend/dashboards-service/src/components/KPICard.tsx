import React from "react";


type KPIProps = {
label: string;
value: string | number;
delta?: number; // +/- percent
footer?: string;
};


const fmtDelta = (d?: number) => {
if (d === undefined || Number.isNaN(d)) return null;
const sign = d > 0 ? "+" : "";
return `${sign}${d.toFixed(1)}%`;
};


const KPICard: React.FC<KPIProps> = ({ label, value, delta, footer }) => {
return (
<div className="card p-4 md:p-5 flex flex-col gap-2">
<span className="h-sub">{label}</span>
<div className="text-2xl md:text-3xl font-semibold text-[color:var(--ink)]">{value}</div>
<div className="flex items-center justify-between mt-1">
<span className="text-sm" style={{ color: "var(--ink-dim)" }}>{footer || ""}</span>
{fmtDelta(delta) && (
<span className="text-sm" style={{ color: delta! >= 0 ? "#00d8a4" : "#ff6b6b" }}>{fmtDelta(delta)}</span>
)}
</div>
</div>
);
};


export default KPICard;