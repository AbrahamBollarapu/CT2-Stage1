// apps/frontend/dashboards-service/src/components/ui/EmptyState.tsx
import React from "react";
import { Button } from "./Button";

export function EmptyState({ title, body, actionText, onAction }: { title: string; body?: string; actionText?: string; onAction?: () => void; }) {
  return (
    <div className="border border-dashed rounded-2xl p-8 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      {body ? <p className="text-sm text-neutral-500 mt-2">{body}</p> : null}
      {actionText ? <Button className="mt-4" variant="secondary" onClick={onAction}>{actionText}</Button> : null}
    </div>
  );
}
