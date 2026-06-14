import { config } from "./config";

type Level = "INFO" | "WARN" | "ERROR";
type LogData = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN =
  /password|secret|token|authorization|cookie|database_url|databaseUrl/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitize(item),
      ])
    );
  }

  return value;
}

function write(level: Level, category: string, message: string, data?: LogData) {
  const safeData = sanitize(data || {}) as LogData;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...safeData,
  };

  if (config.NODE_ENV === "production") {
    const line = JSON.stringify(entry);
    if (level === "ERROR") console.error(line);
    else if (level === "WARN") console.warn(line);
    else console.log(line);
    return;
  }

  const suffix = Object.keys(safeData).length
    ? ` ${JSON.stringify(safeData)}`
    : "";
  const line = `[${entry.timestamp}] [${level}] [${category}] ${message}${suffix}`;

  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
}

export const logger = {
  info(category: string, message: string, data?: LogData) {
    write("INFO", category, message, data);
  },

  warn(category: string, message: string, data?: LogData) {
    write("WARN", category, message, data);
  },

  error(category: string, message: string, data?: LogData) {
    write("ERROR", category, message, data);
  },

  payment(action: string, bookingId: string, amount?: string, requestId?: string) {
    write("INFO", "PAYMENT", `${action} | booking=${bookingId}`, {
      amount,
      requestId,
    });
  },

  statusChange(
    bookingId: string,
    from: string,
    to: string,
    changedBy: string,
    requestId?: string
  ) {
    write("INFO", "STATUS", `${from} -> ${to} | booking=${bookingId}`, {
      changedBy,
      requestId,
    });
  },

  sanitize,
};
