// apps/frontend/dashboards-service/src/components/ui/SectionHeader.tsx
import React from "react";

export function SectionHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode; }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle ? <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}
