/**
 * Structured, content-free logs for Cloud Logging. Never pass audio, transcripts, names, addresses,
 * phone numbers or tool inputs here: only event names, ids, counts and timings.
 */
type Fields = Record<string, string | number | boolean | null | undefined>;

function write(severity: "INFO" | "WARNING" | "ERROR", event: string, fields: Fields, err?: unknown) {
  const error = err === undefined ? undefined : err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 300) : String(err).slice(0, 300);
  console.log(JSON.stringify({ severity, event, ...fields, ...(error ? { error } : {}) }));
}

export const log = {
  info: (event: string, fields: Fields = {}) => write("INFO", event, fields),
  warn: (event: string, fields: Fields = {}, err?: unknown) => write("WARNING", event, fields, err),
  error: (event: string, fields: Fields = {}, err?: unknown) => write("ERROR", event, fields, err),
};
