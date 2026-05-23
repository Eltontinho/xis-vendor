import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Autenticação ─────────────────────────────────────────────────────────────

export function validateSecret(req: Request): boolean {
  const secret   = req.headers.get("x-elton-secret");
  const expected = process.env.ELTON_API_SECRET;
  if (!expected || !secret) return false;
  return secret.length === expected.length &&
    secret.split("").every((c, i) => c === expected[i]);
}

// ─── Rate Limiting ────────────────────────────────────────────────────────────

interface RateLimitResult {
  allowed:   boolean;
  remaining: number;
}

export async function checkRateLimit(
  identifier: string,
  type: "ip" | "phone"
): Promise<RateLimitResult> {
  const windowMinutes = type === "ip" ? 1 : 60;
  const maxRequests   = type === "ip" ? 20 : 60;
  const windowStart   = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  try {
    const { count } = await supabase
      .from("rate_limit_log")
      .select("*", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("type", type)
      .gte("created_at", windowStart);

    const used = count ?? 0;

    if (used >= maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    await supabase.from("rate_limit_log").insert({
      identifier,
      type,
      created_at: new Date().toISOString(),
    });

    return { allowed: true, remaining: maxRequests - used - 1 };
  } catch {
    return { allowed: true, remaining: maxRequests };
  }
}

// ─── Sanitização ──────────────────────────────────────────────────────────────

export function sanitizeInput(text: string): string {
  return text
    .slice(0, 1000)
    .replace(/<[^>]*>/g, "")
    .replace(/[`'"\\]/g, "")
    .replace(/\{\{.*?\}\}/g, "")
    .replace(/\$\{.*?\}/g, "")
    .trim();
}

// ─── Webhook Signature ────────────────────────────────────────────────────────

export function verifyMercadoPagoSignature(
  rawBody: string,
  xSignature: string,
  xRequestId: string
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;

  try {
    const parts  = xSignature.split(",");
    const tsPart = parts.find(p => p.startsWith("ts="));
    const v1Part = parts.find(p => p.startsWith("v1="));
    if (!tsPart || !v1Part) return false;

    const ts   = tsPart.split("=")[1];
    const hash = v1Part.split("=")[1];

    const manifest = `id:${xRequestId};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash,     "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
