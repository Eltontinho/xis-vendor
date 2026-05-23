import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callEltonAgent, ClaudeMessage } from "@/lib/elton/agent";
import { getLead, upsertLead, Lead } from "@/lib/elton/db";
import { LeadStage } from "@/lib/elton/state";
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

const TOTAL_LOTE1 = 200;
const MAX_HISTORY_TURNS = 8;

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

async function runAgent(text: string, phone: string, vagas: number, channel: "web" | "whatsapp"): Promise<string> {
  const stored = await getLead(phone);
  let storedHistory: ClaudeMessage[] = [];
  if (stored) {
    try {
      const raw = typeof stored.history === "string"
        ? JSON.parse(stored.history as unknown as string)
        : stored.history;
      if (Array.isArray(raw)) storedHistory = raw as ClaudeMessage[];
    } catch { /* histórico corrompido */ }
  }

  const recentHistory = storedHistory.slice(-MAX_HISTORY_TURNS * 2);
  const replyText = await callEltonAgent({
    conversationId: phone,
    vagasLote1: vagas,
    history: [...recentHistory, { role: "user", content: text }],
  });

  const updatedLead: Lead = {
    phone,
    stage: stored?.stage ?? LeadStage.NOVO,
    history: [...recentHistory, { role: "user", content: text }, { role: "assistant", content: replyText }],
    channel,
    updatedAt: new Date().toISOString(),
  };
  await upsertLead(updatedLead);

  return replyText;
}

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
      const vagas = await getVagas();
      const reply = await runAgent(text, phone, vagas, "whatsapp");
      await sendMessage(phone, reply);
    } catch (err) {
      console.error("[WA] button error:", err);
    }
    return Response.json({ received: true });
  }

  // ── Mensagem de texto ─────────────────────────────────────────────────────
  const text = payload.text?.message?.trim() ?? "";
  if (!text) return Response.json({ received: true });

  console.log(`[WA] msg: "${text.slice(0, 60)}" de ${phone}`);

  if (OFENSIVO.some((p) => text.toLowerCase().includes(p))) {
    await sendMessage(phone, "A K-RRO não compactua com esse tipo de comentário. Encerrando o atendimento.");
    return Response.json({ received: true });
  }

  try {
    const vagas = await getVagas();
    const reply = await runAgent(text, phone, vagas, "whatsapp");

    if (reply.includes("{{CLUBE_KRRO}}")) {
      const before = reply.replace("{{CLUBE_KRRO}}", "").trim();
      if (before) await sendMessage(phone, before);
      await sendPlanButtons(phone);
    } else {
      await sendMessage(phone, reply);
    }
  } catch (err) {
    console.error("[WA] agent error:", err);
    await sendMessage(phone, "Sistema temporariamente indisponível. Tente novamente em instantes.");
  }

  return Response.json({ received: true });
}
