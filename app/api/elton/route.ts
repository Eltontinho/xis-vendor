import { NextRequest, NextResponse } from "next/server";
import { eltonAgent } from "@/lib/elton/agent";
import { validateSecret, checkRateLimit, sanitizeInput } from "@/lib/elton/security";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!validateSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipLimit = await checkRateLimit(ip, "ip");
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  let rawMessage: string;
  let phone: string;

  try {
    const body = await req.json();
    rawMessage = body.message ?? "";
    phone      = String(body.phone ?? "").trim();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const message = sanitizeInput(rawMessage);
  if (!message || !phone) {
    return NextResponse.json({ error: "missing fields: message, phone" }, { status: 400 });
  }

  const phoneLimit = await checkRateLimit(phone, "phone");
  if (!phoneLimit.allowed) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  try {
    const result = await eltonAgent(message, phone);
    return NextResponse.json({
      agent:   "ELTON",
      message: result.message,
      stage:   result.stage,
      vagas:   result.vagas,
    });
  } catch (error) {
    console.error("[/api/elton] Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
