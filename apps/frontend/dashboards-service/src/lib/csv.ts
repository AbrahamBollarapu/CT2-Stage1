// Simple CSV builder + download
export function toCsv(rows: Record<string, any>[], headers?: string[]): string {
  if (!rows?.length) return "";
  const keys = headers?.length ? headers : Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = keys.map(esc).join(",");
  const body = rows.map(r => keys.map(k => esc(r[k])).join(",")).join("\n");
  return head + "\n" + body;
}

export function downloadCsv(csv: string, filename = "export.csv") {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
