const BASE = "https://graph.facebook.com/v19.0";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendMessage(phone: string, text: string): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!phoneId || !token) return;

  const res = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(phone),
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    console.error("[WhatsApp] sendMessage error:", await res.text());
  }
}

export async function sendPlanButtons(phone: string): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!phoneId || !token) return;

  const res = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(phone),
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: "Deixa eu te mostrar o Clube K-RRO.\n\n💳 PLATINA — R$397/ano — 94% por corrida\n🥈 OURO — R$347/ano — 92% por corrida\n⚫ PRATA — R$297/ano — 90% por corrida\n\nQual plano é o seu?",
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "plan_platina", title: "💳 PLATINA R$397" } },
            { type: "reply", reply: { id: "plan_ouro",    title: "🥈 OURO R$347"    } },
            { type: "reply", reply: { id: "plan_prata",   title: "⚫ PRATA R$297"   } },
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("[WhatsApp] sendPlanButtons error:", await res.text());
  }
}

export async function sendTemplate(
  phone: string,
  templateName: string,
  params: string[] = []
): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!phoneId || !token) return;

  const res = await fetch(`${BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(phone),
      type: "template",
      template: {
        name: templateName,
        language: { code: "pt_BR" },
        components:
          params.length > 0
            ? [
                {
                  type: "body",
                  parameters: params.map((text) => ({ type: "text", text })),
                },
              ]
            : [],
      },
    }),
  });

  if (!res.ok) {
    console.error("[WhatsApp] sendTemplate error:", await res.text());
  }
}
