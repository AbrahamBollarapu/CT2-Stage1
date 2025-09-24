// apps/frontend/dashboards-service/src/components/layout/AppShell.tsx
import React from "react";
import { Badge } from "../ui";
import { Link } from "react-router-dom";

const ENV = import.meta.env.VITE_ENV ?? "DEV";

export function AppShell({ children }: React.PropsWithChildren) {
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 dark:bg-neutral-900/70 border-b border-black/5">
        <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-semibold tracking-tight">CogTechAI</Link>
            <Badge tone="neutral">{ENV}</Badge>
          </div>
          <nav className="text-sm flex items-center gap-4">
            <Link className="hover:underline" to="/">Home</Link>
            <Link className="hover:underline" to="/app">Dashboard</Link>
            <a className="hover:underline" href="/reports" onClick={(e) => e.preventDefault()}>Reports (soon)</a>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
