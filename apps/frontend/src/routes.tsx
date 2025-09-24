// apps/frontend/src/routes.tsx
import { createBrowserRouter } from "react-router-dom";
import AppShell from "./ui/AppShell";
import Landing from "./ui/Landing";
import Dashboard from "./ui/Dashboard";
import Suppliers from "./ui/Suppliers";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Landing /> },
      { path: "app", element: <Dashboard /> },
      { path: "suppliers", element: <Suppliers /> }
    ],
  },
]);
