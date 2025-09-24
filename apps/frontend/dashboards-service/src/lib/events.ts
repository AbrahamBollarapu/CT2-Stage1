// D:\CT2\apps\frontend\dashboards-service\src\lib\events.ts
// Central place for event names & helpers (avoids typos).

export const EV_GOLIVE_OPEN = "golive:open";
export const EV_INGEST_TICK = "ingest:tick";

export function dispatch(name: string) {
  window.dispatchEvent(new Event(name));
}

export function on(name: string, fn: EventListenerOrEventListenerObject) {
  window.addEventListener(name, fn as any);
  return () => window.removeEventListener(name, fn as any);
}
