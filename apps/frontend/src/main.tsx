﻿import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { ToastProvider } from "./ui/toast"; // ← NEW: global toasts

import AppShell from "./ui/AppShell";
import Dashboard from "./ui/Dashboard";
import Suppliers from "./ui/Suppliers";
import Landing from "./ui/Landing";
import Reports from "./pages/Reports";

const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "suppliers", element: <Suppliers /> },
      { path: "reports", element: <Reports /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </React.StrictMode>
);
