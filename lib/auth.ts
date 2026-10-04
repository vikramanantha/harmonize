// Phone apps authenticate with the device token issued at login:
//   Authorization: Bearer <token>
import { accountByToken, type Account } from "./db";

export const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function requireAccount(request: Request): Account {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const account = token ? accountByToken(token) : null;
  if (!account) throw new HttpError(401, "Not logged in. Open the app and log in again.");
  return account;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415, "Expected JSON.");
  if (Number(request.headers.get("content-length")) > 16_000) throw new HttpError(413, "Request too large.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request.");
  return body as Record<string, unknown>;
}

/** Wraps a route handler so thrown errors become JSON responses instead of HTML 500 pages. */
export function handler(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await fn(request);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${request.method} ${new URL(request.url).pathname} failed:`, message);
      return json({ error: message }, 500);
    }
  };
}
