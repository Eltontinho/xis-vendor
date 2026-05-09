function zapiBase(): string {
  const id    = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  if (!id || !token) throw new Error("[Z-API] ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados");
  return `https://api.z-api.io/instances/${id}/token/${token}`;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

async function zapiPost(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${zapiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    console.error(`[Z-API] ${path} error ${res.status}:`, err);
  }
}

export async function sendMessage(phone: string, text: string): Promise<void> {
  await zapiPost("/send-text", {
    phone:   normalizePhone(phone),
    message: text,
  });
}

export async function sendButtons(
  phone: string,
  title: string,
  buttons: { id: string; title: string }[]
): Promise<void> {
  await zapiPost("/send-button-list", {
    phone:   normalizePhone(phone),
    message: title,
    buttonList: {
      buttons: buttons.map((b) => ({ id: b.id, label: b.title })),
    },
  });
}

export async function sendPlanButtons(phone: string): Promise<void> {
  await sendButtons(
    phone,
    "Deixa eu te mostrar o Clube K-RRO.\n\n" +
    "💳 PLATINA — R$397/ano — 94% por corrida\n" +
    "🥈 OURO — R$347/ano — 92% por corrida\n" +
    "⚫ PRATA — R$297/ano — 90% por corrida\n\n" +
    "Qual plano é o seu?",
    [
      { id: "plan_platina", title: "💳 PLATINA R$397/ano" },
      { id: "plan_ouro",    title: "🥈 OURO R$347/ano"   },
      { id: "plan_prata",   title: "⚫ PRATA R$297/ano"  },
    ]
  );
}
