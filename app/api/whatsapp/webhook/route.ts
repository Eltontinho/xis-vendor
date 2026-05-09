import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { eltonAgent } from "@/lib/elton/agent";
import { sendMessage, sendPlanButtons } from "@/lib/whatsapp/client";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "";
const TOTAL_LOTE1 = 200;

const OFENSIVO = [
  "negro", "preto", "viado", "gay", "bicha", "raça", "macaco",
  "judeu", "nazista", "puta", "vadia", "mulher no volante", "feminista",
];

// Map de button_reply.id → texto que o agente vai processar
const BUTTON_TEXT: Record<string, string> = {
  plan_platina: "Quero o PLATINA",
  plan_ouro:    "Quero o OURO",
  plan_prata:   "Quero o PRATA",
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getVagas(): Promise<number> {
  const { count } = await supabase
    .from("lead_states")
    .select("*", { count: "exact", head: true })
    .eq("stage", "convertido");
  return Math.max(TOTAL_LOTE1 - (count ?? 0), 0);
}

// GET: verificação do webhook Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// POST: recebe mensagens do WhatsApp
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ received: true });
  }

  const entry = (body as { entry?: unknown[] })?.entry;
  const value = (entry as { changes?: { value?: unknown }[] }[])?.[0]
    ?.changes?.[0]?.value as {
    messages?: unknown[];
  } | undefined;

  const messages = value?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ received: true });
  }

  const msg = messages[0] as {
    from?: string;
    type?: string;
    text?: { body?: string };
    interactive?: { type?: string; button_reply?: { id?: string; title?: string } };
  };

  const phone = msg.from ?? "";
  if (!phone) return Response.json({ received: true });

  // ── Botão interativo clicado ──────────────────────────────────────────────
  if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
    const buttonId = msg.interactive.button_reply?.id ?? "";
    const text = BUTTON_TEXT[buttonId];

    if (!text) return Response.json({ received: true });

    console.log(`[WA webhook] button: ${buttonId} → "${text}" de ${phone}`);
    try {
      const vagas  = await getVagas();
      const result = await eltonAgent(text, phone, vagas, "whatsapp");
      // Resposta do agente ao clique no botão — nunca volta botões aqui
      await sendMessage(phone, result.message);
    } catch (err) {
      console.error("[WA webhook] button handler error:", err);
    }
    return Response.json({ received: true });
  }

  // ── Mensagem de texto normal ──────────────────────────────────────────────
  if (msg.type !== "text") return Response.json({ received: true });

  const text = msg.text?.body?.trim() ?? "";
  if (!text) return Response.json({ received: true });

  console.log(`[WA webhook] text: "${text.slice(0, 60)}" de ${phone}`);

  // Filtro ofensivo
  if (OFENSIVO.some((p) => text.toLowerCase().includes(p))) {
    await sendMessage(
      phone,
      "A K-RRO não compactua com esse tipo de comentário. Encerrando o atendimento."
    );
    return Response.json({ received: true });
  }

  try {
    const vagas  = await getVagas();
    const result = await eltonAgent(text, phone, vagas, "whatsapp");

    // Se o agente quer mostrar o Clube K-RRO → botões interativos
    if (result.message.includes("{{CLUBE_KRRO}}")) {
      // Remove o placeholder e envia o texto antes dos botões (se houver)
      const beforeClub = result.message.replace("{{CLUBE_KRRO}}", "").trim();
      if (beforeClub) await sendMessage(phone, beforeClub);
      await sendPlanButtons(phone);
    } else {
      await sendMessage(phone, result.message);
    }
  } catch (err) {
    console.error("[WA webhook] agent error:", err);
    await sendMessage(
      phone,
      "Sistema temporariamente indisponível. Tente novamente em instantes."
    );
  }

  return Response.json({ received: true });
}
