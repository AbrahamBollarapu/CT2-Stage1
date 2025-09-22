// apps/frontend/dashboards-service/src/pages/Dashboard.tsx
import TimeSeriesChart from "../components/TimeSeriesChart";

export default function Dashboard() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Energy Consumption</h2>
      <TimeSeriesChart />
    </div>
  );
}
