import { useCallback, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500); }, []);
  const node = msg ? (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="px-3 py-2 rounded-xl shadow-lift border" style={{background:"var(--card)", borderColor:"var(--line)"}}>
        <span className="text-sm">{msg}</span>
      </div>
    </div>
  ) : null;
  return { toast, node };
}
