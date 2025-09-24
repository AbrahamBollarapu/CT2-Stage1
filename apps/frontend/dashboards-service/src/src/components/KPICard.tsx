import React from "react";
export default function KPICard({ label, value, trend, children }:{ label:string; value:string; trend?:number|null; children?:React.ReactNode; }) {
  return (
    <div className="ui-card p-4">
      <div className="kicker">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {trend != null && (
        <div className={`mt-1 text-sm ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
          {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
      {children}
    </div>
  );
}
