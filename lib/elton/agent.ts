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
    console.log("[ELTON] iniciando agent para phone:", phone);
    console.log("[ELTON] DEEPSEEK_API_KEY presente:", !!process.env.DEEPSEEK_API_KEY);
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

    const finalReply = replyText;

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
    console.error("[ELTON] agent error completo:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return { message: "Sistema temporariamente indisponível. Tente novamente.", stage: LeadStage.NOVO };
  }
}
