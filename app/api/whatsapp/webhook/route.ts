import { NextRequest } from "next/server";
import { eltonAgent } from "@/lib/elton/agent";
import { sendMessage, sendPlanButtons } from "@/lib/whatsapp/client";

const OFENSIVO = [
  "negro", "preto", "viado", "gay", "bicha", "raça", "macaco",
  "judeu", "nazista", "puta", "vadia", "mulher no volante", "feminista",
];

const BUTTON_TEXT: Record<string, string> = {
  plan_platina: "Quero o PLATINA",
  plan_ouro:    "Quero o OURO",
  plan_prata:   "Quero o PRATA",
};

// GET: Z-API não faz verificação de token — responde 200 direto
export async function GET() {
  return new Response("OK", { status: 200 });
}

// POST: recebe eventos do Z-API
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ received: true });
  }

  const payload = body as {
    phone?:          string;
    fromMe?:         boolean;
    text?:           { message?: string };
    buttonResponse?: { selectedButtonId?: string };
  };

  if (payload.fromMe) return Response.json({ received: true });

  const phone = payload.phone?.replace(/\D/g, "") ?? "";
  if (!phone) return Response.json({ received: true });

  // ── Clique em botão ───────────────────────────────────────────────────────
  const buttonId = payload.buttonResponse?.selectedButtonId;
  if (buttonId) {
    const text = BUTTON_TEXT[buttonId];
    if (!text) return Response.json({ received: true });

    console.log(`[WA] button: ${buttonId} → "${text}" de ${phone}`);
    try {
      const result = await eltonAgent(text, phone);
      await sendMessage(phone, result.message);
    } catch (err) {
      console.error("[WA] button error:", err);
    }
    return Response.json({ received: true });
  }

  // ── Mensagem de texto ─────────────────────────────────────────────────────
  const text = payload.text?.message?.trim() ?? "";
  if (!text) return Response.json({ received: true });

  console.log(`[WA] msg: "${text.slice(0, 60)}" de ${phone}`);

  if (OFENSIVO.some(p => text.toLowerCase().includes(p))) {
    await sendMessage(phone, "A K-RRO não compactua com esse tipo de comentário. Encerrando o atendimento.");
    return Response.json({ received: true });
  }

  try {
    const result = await eltonAgent(text, phone);

    if (result.message.includes("{{CLUBE_KRRO}}")) {
      const before = result.message.replace("{{CLUBE_KRRO}}", "").trim();
      if (before) await sendMessage(phone, before);
      await sendPlanButtons(phone);
    } else {
      await sendMessage(phone, result.message);
    }
  } catch (err) {
    console.error("[WA] agent error:", err);
    await sendMessage(phone, "Sistema temporariamente indisponível. Tente novamente em instantes.");
  }

  return Response.json({ received: true });
}
