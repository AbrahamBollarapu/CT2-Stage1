// apps/frontend/dashboards-service/src/ui/AppShell.tsx
import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const ENV = import.meta.env.VITE_ENV ?? "DEV";

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("ct2:theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) { root.classList.add("dark"); localStorage.setItem("ct2:theme", "dark"); }
    else { root.classList.remove("dark"); localStorage.setItem("ct2:theme", "light"); }
  }, [dark]);

  return { dark, setDark, toggle: () => setDark((v) => !v) };
}

export default function AppShell() {
  const { pathname } = useLocation();
  const { dark, toggle } = useDarkMode();

  const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => {
    const active = pathname === to || (to !== "/" && pathname.startsWith(to));
    return (
      <Link
        className={`text-sm px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
          active ? "font-semibold underline" : ""
        }`}
        to={to}
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/80 dark:bg-neutral-900/70 border-b border-black/5">
        <div className="mx-auto max-w-[1200px] px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="font-semibold tracking-tight">CogTechAI</Link>
            <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800">
              {ENV}
            </span>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/app">Dashboard</NavLink>
            <NavLink to="/app/suppliers">Suppliers</NavLink>
            <NavLink to="/app/devices">Devices</NavLink>
            <a className="text-sm px-2 py-1 rounded-lg opacity-60 cursor-not-allowed">Reports (soon)</a>
            <button
              onClick={toggle}
              className="ml-2 text-sm px-3 py-1.5 rounded-xl border border-black/10 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              title={dark ? "Switch to light" : "Switch to dark"}
              aria-label="Toggle dark mode"
            >
              {dark ? "🌙 Dark" : "☀️ Light"}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
