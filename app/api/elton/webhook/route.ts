import { NextRequest } from "next/server";
import { verifyMercadoPagoSignature } from "@/lib/elton/security";
import { processWebhookPayment } from "@/lib/elton/payment";

export async function POST(req: NextRequest) {
  const rawBody    = await req.text();
  const xSignature = req.headers.get("x-signature")   ?? "";
  const xRequestId = req.headers.get("x-request-id")  ?? "";

  if (!verifyMercadoPagoSignature(rawBody, xSignature, xRequestId)) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: { type?: string; data?: { id?: string | number } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.type !== "payment" || !body.data?.id) {
    return Response.json({ ok: true });
  }

  const mpPaymentId = String(body.data.id);

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });

  if (!res.ok) {
    return Response.json({ error: "mp_fetch_failed" }, { status: 502 });
  }

  const payment = await res.json();
  const status: string = payment.status;

  if (status === "approved" || status === "rejected" || status === "refunded") {
    await processWebhookPayment(mpPaymentId, status as "approved" | "rejected" | "refunded");
  }

  return Response.json({ ok: true });
}
