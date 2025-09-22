import { createBrowserRouter, Navigate } from "react-router-dom";
import Dashboard from "./ui/Dashboard";
import Suppliers from "./pages/Suppliers";
import Reports from "./pages/Reports";

function Layout({ children }: { children: React.ReactNode }) {
  const org = (import.meta.env.VITE_ORG_ID as string) || "test-org";
  return (
    <div style={{ padding: 12 }}>
      <nav style={{ marginBottom: 12 }}>
        <a href="/app" style={{ marginRight: 12 }}>Dashboards</a>
        <a href="/app/suppliers" style={{ marginRight: 12 }}>Suppliers</a>
        <a href="/app/reports" style={{ marginRight: 12 }}>Reports</a>
        <span style={{ float: "right", opacity: 0.6, fontSize: 12 }}>org: {org}</span>
      </nav>
      {children}
    </div>
  );
}

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app" replace /> },
  {
    path: "/app",
    element: (
      <Layout>
        <Dashboard />
      </Layout>
    ),
  },
  {
    path: "/app/suppliers",
    element: (
      <Layout>
        <Suppliers />
      </Layout>
    ),
  },
  {
    path: "/app/reports",
    element: (
      <Layout>
        <Reports />
      </Layout>
    ),
  },
  { path: "*", element: <Navigate to="/app" replace /> },
]);
