import OpenAI from "openai";
import { getEltonSystemPrompt }                    from "./system";
import { getLead, upsertLead, upsertLeadProfile, Lead } from "./db";
import { detectIntent, getNextStage, LeadStage }   from "./state";
import { validateEltonOutput, ELTON_FALLBACK }     from "./validator";

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey:  process.env.DEEPSEEK_API_KEY!,
});

const MAX_HISTORY_TURNS = 8;

type HistoryMsg = { role: string; content: string };

function extractPhone(history: HistoryMsg[]): string | null {
  for (const msg of history) {
    if (msg.role !== "user") continue;
    const m = msg.content.match(/\b(\d{2})\s*9?\d{4}[-\s]?\d{4}\b/);
    if (m) return m[0].replace(/\D/g, "");
  }
  return null;
}

function extractField(history: HistoryMsg[], keywords: string[]): string {
  for (let i = 0; i < history.length - 1; i++) {
    const q = history[i];
    const a = history[i + 1];
    if (q.role !== "assistant" || a.role !== "user") continue;
    if (keywords.some((k) => q.content.toLowerCase().includes(k))) {
      return a.content.split(/[\n,]/)[0].trim().slice(0, 80);
    }
  }
  return "";
}

export async function eltonAgent(
  message: string,
  phone:   string,
  vagas:   number,
  channel: "web" | "whatsapp" = "web"
): Promise<{ message: string; stage: LeadStage; image?: string }> {
  try {
    let lead: Lead = (await getLead(phone)) ?? {
      phone,
      stage:     LeadStage.NOVO,
      history:   [],
      channel,
      updatedAt: new Date().toISOString(),
    };

    console.log(`[ELTON] getLead resultado:`, lead ? `encontrado (${lead.history?.length} msgs)` : `NÃO encontrado — phone: ${phone}`);
    console.log(`[ELTON] lead carregado:`, lead.phone, `stage:`, lead.stage, `history:`, lead.history?.length ?? 0, `turnos`);

    try {
      if (typeof lead.history === "string") {
        lead.history = JSON.parse(lead.history);
      }
    } catch {
      lead.history = [];
    }
    if (!Array.isArray(lead.history)) lead.history = [];

    const recentHistory = lead.history.slice(-MAX_HISTORY_TURNS * 2);

    const response = await deepseek.chat.completions.create({
      model:       "deepseek-chat",
      temperature: 0.6,
      max_tokens:  450,
      messages: [
        { role: "system", content: getEltonSystemPrompt(vagas) },
        ...recentHistory,
        { role: "user", content: message },
      ],
    });

    const rawText = response.choices?.[0]?.message?.content ?? "";
    const replyText = validateEltonOutput(rawText) ? rawText : ELTON_FALLBACK;

    // Auto-gera link de pagamento quando todos os 4 campos do cadastro estão presentes
    let finalReply = replyText;
    const histAll = [...recentHistory, { role: "user", content: message }, { role: "assistant", content: replyText }];
    const alreadyHasLink = lead.history.some((h) => h.role === "assistant" && h.content.includes("mercadopago.com"));
    const collectedPhone = extractPhone(histAll);
    const collectedName  = extractField(histAll, ["nome", "chama", "completo"]);
    const collectedAddr  = extractField(histAll, ["endereço", "endereco", "cep", "rua", "bairro"]);
    // Padrão BR: AAA0000 (antigo) ou AAA0A00 (Mercosul)
    const PLATE_RE = /\b[A-Z]{3}[-\s]?(?:\d[A-Z]\d{2}|\d{4})\b/i;
    const plateMatch = histAll.reduce<string | null>((found, h) => {
      if (found || h.role !== "user") return found;
      const m = h.content.match(PLATE_RE);
      return m ? m[0] : found;
    }, null);

    const phoneDigits = (collectedPhone ?? "").replace(/\D/g, "");
    const validPhone  = phoneDigits.length >= 10;
    const validName   = collectedName.trim().split(/\s+/).length >= 2;
    const validAddr   = collectedAddr.trim().length >= 10;
    const validPlate  = !!plateMatch && PLATE_RE.test(plateMatch);

    if (!alreadyHasLink && validPhone && validName && validAddr && validPlate) {
      const planLots: Record<string, string> = { platina: "lote1", ouro: "lote2", prata: "lote3" };
      const planKey = (["platina", "ouro", "prata"] as const).find((p) =>
        lead.history.some((h) => h.role === "assistant" && h.content.toLowerCase().includes(p))
      ) ?? "platina";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      try {
        const reserveRes = await fetch(`${appUrl}/api/reserve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lot:            planLots[planKey],
            conversation_id: phone,
            driver_phone:   collectedPhone,
            driver_name:    collectedName,
            driver_city:    extractField(histAll, ["cidade", "dirige", "região"]),
          }),
        });
        const reserveData = await reserveRes.json();
        finalReply = reserveData.success && reserveData.checkout_url
          ? `Aqui está seu link de pagamento: ${reserveData.checkout_url}\n\nVálido por 15 minutos. Qualquer dúvida é só chamar.`
          : "Tive um problema técnico ao gerar o link. Me chama em instantes que resolvo.";
      } catch {
        finalReply = "Tive um problema técnico ao gerar o link. Me chama em instantes que resolvo.";
      }
    }

    lead.history = [
      ...recentHistory,
      { role: "user",      content: message    },
      { role: "assistant", content: finalReply },
    ];
    lead.channel = channel;

    const intent = detectIntent(message);
    lead.stage   = getNextStage(lead.stage, intent);

    console.log(`[ELTON] salvando histórico:`, lead.history.length, `mensagens`);
    await upsertLead(lead);

    // Persiste perfil qualificado na tabela leads quando telefone coletado
    if (lead.stage === LeadStage.QUALIFICADO) {
      const telefone = extractPhone(lead.history);
      if (telefone) {
        upsertLeadProfile({
          telefone,
          nome:    extractField(lead.history, ["nome", "chama"]),
          cidade:  extractField(lead.history, ["cidade", "dirige", "região"]),
          veiculo: extractField(lead.history, ["veículo", "veiculo", "carro", "modelo"]),
        }).catch((e) => console.warn("[ELTON] upsertLeadProfile error:", e));
      }
    }

    const replyLower = finalReply.toLowerCase();
    let image: string | undefined;
    if (lead.history.length === 2) {
      image = "/cards/krro-apresentacao.jpg";
    } else if (replyLower.includes("platina")) {
      image = "/cards/clube-platina.jpg";
    } else if (replyLower.includes("ouro")) {
      image = "/cards/clube-ouro.jpg";
    } else if (replyLower.includes("prata")) {
      image = "/cards/clube-prata.jpg";
    }

    return { message: finalReply, stage: lead.stage, image };
  } catch (err) {
    console.error("[ELTON] agent error:", err);
    return {
      message: "Sistema temporariamente indisponível. Tente novamente.",
      stage:   LeadStage.NOVO,
    };
  }
}
