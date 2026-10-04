// Unauthenticated liveness check (for ngrok and the phones).
import { json } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = async () => json({ ok: true });
