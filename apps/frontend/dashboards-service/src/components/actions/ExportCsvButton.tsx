import React from "react";
import { toCsv, downloadCsv } from "../../lib/csv";

type Props = {
  data: Record<string, any>[];
  headers?: string[];        // optional explicit column order
  filename?: string;
  className?: string;
};

export default function ExportCsvButton({ data, headers, filename = "suppliers.csv", className = "" }: Props) {
  return (
    <button
      className={`inline-flex items-center rounded-xl bg-black text-white px-3 py-1.5 text-sm hover:opacity-90 active:scale-[0.98] ${className}`}
      onClick={() => {
        const csv = toCsv(data, headers);
        downloadCsv(csv, filename);
      }}
      disabled={!data?.length}
      title={data?.length ? "Export CSV" : "No data to export"}
    >
      ⬇ Export CSV
    </button>
  );
}
