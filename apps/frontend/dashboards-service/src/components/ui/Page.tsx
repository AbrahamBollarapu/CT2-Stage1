// apps/frontend/dashboards-service/src/components/ui/Page.tsx
import React from "react";

export function Page({ children }: React.PropsWithChildren) {
  return <div className="mx-auto w-full max-w-[1200px] px-4 py-6">{children}</div>;
}
