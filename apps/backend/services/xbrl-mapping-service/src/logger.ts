export type LogLevel = "debug" | "info" | "warn" | "error";
const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minName = (process.env.LOG_LEVEL || "info").toLowerCase() as LogLevel;
const min = LEVELS[minName] ?? 20;
const service = process.env.SERVICE_NAME || (process as any).env?.npm_package_name || "service";

function emit(level: LogLevel, msg: string, fields: Record<string, any> = {}) {
  const rec: any = { level, time: new Date().toISOString(), service, msg, ...fields };
  try { console.log(JSON.stringify(rec)); } catch { /* ignore */ }
}

export const log = {
  debug: (msg: string, f?: Record<string, any>) => { if (min <= 10) emit("debug", msg, f); },
  info:  (msg: string, f?: Record<string, any>) => { if (min <= 20) emit("info",  msg, f); },
  warn:  (msg: string, f?: Record<string, any>) => { if (min <= 30) emit("warn",  msg, f); },
  error: (msg: string, f?: Record<string, any>) => emit("error", msg, f),
};