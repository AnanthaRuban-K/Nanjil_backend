import { config } from "./config";

type Level = "INFO" | "WARN" | "ERROR";

function formatLog(level: Level, category: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] [${category}] ${message}`;
  if (data && config.NODE_ENV !== "production") {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
}

export const logger = {
  info(category: string, message: string, data?: unknown) {
    console.log(formatLog("INFO", category, message, data));
  },

  warn(category: string, message: string, data?: unknown) {
    console.warn(formatLog("WARN", category, message, data));
  },

  error(category: string, message: string, data?: unknown) {
    console.error(formatLog("ERROR", category, message, data));
  },

  payment(action: string, bookingId: string, amount?: string) {
    console.log(
      formatLog("INFO", "PAYMENT", `${action} | booking=${bookingId}`, { amount })
    );
  },

  statusChange(
    bookingId: string,
    from: string,
    to: string,
    changedBy: string
  ) {
    console.log(
      formatLog("INFO", "STATUS", `${from} → ${to} | booking=${bookingId} | by=${changedBy}`)
    );
  },
};