// apps/frontend/dashboards-service/src/components/ui/Card.tsx
import React from "react";

type Props = React.PropsWithChildren<{
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
}>;

export function Card({ className = "", title, subtitle, footer, children }: Props) {
  return (
    <div className={`rounded-2xl shadow-sm border border-black/5 bg-white dark:bg-neutral-900 ${className}`}>
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-black/5">
          <div className="text-sm font-semibold">{title}</div>
          {subtitle ? <div className="text-xs text-neutral-500 mt-0.5">{subtitle}</div> : null}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="px-4 py-3 border-t border-black/5">{footer}</div>}
    </div>
  );
}
