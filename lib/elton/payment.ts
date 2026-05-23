import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MP_BASE  = "https://api.mercadopago.com";
const MP_TOKEN = process.env.MP_ACCESS_TOKEN!;

export type PlanKey = "prata" | "ouro" | "platina";

const PLAN_PRICES: Record<PlanKey, number> = {
  prata:   19700,
  ouro:    29700,
  platina: 39700,
};

export async function createPaymentPreference(
  phone: string,
  plan: PlanKey,
  driverName: string
): Promise<{ checkoutUrl: string; preferenceId: string }> {
  const idempotencyKey = crypto
    .createHash("sha256")
    .update(`${phone}:${plan}:${Date.now()}`)
    .digest("hex");

  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("phone", phone)
    .in("status", ["pending", "approved"])
    .single();

  if (existing) {
    throw new Error("Pagamento já existente para este motorista.");
  }

  const res = await fetch(`${MP_BASE}/checkout/preferences`, {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "Authorization":     `Bearer ${MP_TOKEN}`,
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      items: [{
        title:       `Clube K-RRO — Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)} Fundador`,
        quantity:    1,
        unit_price:  PLAN_PRICES[plan] / 100,
        currency_id: "BRL",
      }],
      payer: {
        name:  driverName,
        phone: { number: phone },
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_BASE_URL}/obrigado`,
        failure: `${process.env.NEXT_PUBLIC_BASE_URL}/erro`,
        pending: `${process.env.NEXT_PUBLIC_BASE_URL}/pendente`,
      },
      auto_return:          "approved",
      notification_url:     `${process.env.NEXT_PUBLIC_BASE_URL}/api/elton/webhook`,
      statement_descriptor: "KLUBKRRO",
      metadata: { phone, plan },
    }),
  });

  if (!res.ok) {
    throw new Error(`Mercado Pago error: ${res.status}`);
  }

  const data = await res.json();

  await supabase.from("payments").insert({
    phone,
    mp_payment_id:   data.id,
    plan,
    amount_cents:    PLAN_PRICES[plan],
    status:          "pending",
    idempotency_key: idempotencyKey,
  });

  return {
    checkoutUrl:  data.init_point,
    preferenceId: data.id,
  };
}

export async function processWebhookPayment(
  mpPaymentId: string,
  status: "approved" | "rejected" | "refunded"
): Promise<void> {
  await supabase
    .from("payments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("mp_payment_id", mpPaymentId);

  if (status === "approved") {
    const { data: payment } = await supabase
      .from("payments")
      .select("phone, plan")
      .eq("mp_payment_id", mpPaymentId)
      .single();

    if (payment) {
      await supabase
        .from("lead_profiles")
        .update({
          stage:        "convertido",
          plan_chosen:  payment.plan,
          converted_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq("phone", payment.phone);
    }
  }
}
