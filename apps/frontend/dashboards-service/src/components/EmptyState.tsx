import React from "react";


const EmptyState: React.FC<{ title?: string; subtitle?: string; cta?: React.ReactNode }>=({
title = "No data yet",
subtitle = "Click Go Live to start streaming points. Your chart and KPIs will light up instantly.",
cta,
}) => {
return (
<div className="card p-10 text-center flex flex-col items-center justify-center">
<svg className="empty-illustration mb-6" width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="60" cy="60" r="56" stroke="#2a323c" strokeWidth="2" />
<path d="M30 75 C45 60, 75 60, 90 75" stroke="#37a2ff" strokeWidth="3" fill="none" />
<circle cx="42" cy="48" r="5" fill="#37a2ff" />
<circle cx="78" cy="50" r="5" fill="#00d8a4" />
</svg>
<h3 className="text-xl font-semibold text-[color:var(--ink)]">{title}</h3>
<p className="h-sub mt-2 max-w-[42ch]">{subtitle}</p>
{cta && <div className="mt-6">{cta}</div>}
</div>
);
};


export default EmptyState;