import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

const TOTAL_LOTE1 = 200;

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

  // Ignora mensagens enviadas por nós mesmos
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
      const vagas  = await getVagas();
      const result = await eltonAgent(text, phone, vagas, "whatsapp");
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

    if (result.message.includes("{{CLUBE_KRRO}}")) {
      const before = result.message.replace("{{CLUBE_KRRO}}", "").trim();
      if (before) await sendMessage(phone, before);
      await sendPlanButtons(phone);
    } else {
      await sendMessage(phone, result.message);
    }
  } catch (err) {
    console.error("[WA] agent error:", err);
    await sendMessage(
      phone,
      "Sistema temporariamente indisponível. Tente novamente em instantes."
    );
  }

  return Response.json({ received: true });
}
