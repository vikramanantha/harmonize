import { neon, types } from "@neondatabase/serverless";
import { config } from "./config";

// Millisecond timestamps and COUNT(*) arrive as Postgres int8 strings by default.
types.setTypeParser(20, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Database integer exceeds JavaScript's safe range");
  return number;
});

/** Lazy initialization lets Next build without production credentials. */
export function database() {
  return neon(config.databaseUrl);
}
