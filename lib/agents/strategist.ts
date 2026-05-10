export type StrategyType =
  | "saudacao"
  | "abrir_gap"
  | "explorar_dor"
  | "ancorar_realidade"
  | "conectar_krro"
  | "responder_direto"
  | "mostrar_clube"
  | "fechar";

export interface StrategyOutput {
  type: StrategyType;
}

const STRATEGIST_PROMPT = `Você decide o próximo movimento em uma conversa de vendas para motoristas de app.

Movimentos disponíveis:
- saudacao: primeira mensagem — apresente-se e pergunte o nome
- abrir_gap: crie curiosidade sem explicar ainda
- explorar_dor: aprofunde a dor que o motorista revelou
- ancorar_realidade: corrija expectativa irreal de ganho com números reais
- conectar_krro: ligue a dor identificada com a K-RRO
- responder_direto: responda pergunta direta sem rodeio
- mostrar_clube: hora de mostrar os cards dos planos
- fechar: motorista escolheu — colete dados em ordem

Retorne APENAS o JSON, sem explicação. Exemplo:
{"type":"explorar_dor"}`;

async function callHaiku(messages: { role: string; content: string }[]): Promise<string> {
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const conversation = messages.filter((m) => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      system: systemMsg,
      messages: conversation,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Haiku strategist ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

function fallbackStrategize(message: string, history: string[]): StrategyType {
  if (history.length === 0) return "saudacao";
  const t = message.toLowerCase();
  if (t.includes("?") || t.includes("quanto") || t.includes("como") || t.includes("funciona"))
    return "responder_direto";
  if (history.some((h) => h.toLowerCase().includes("clube_krro") || h.toLowerCase().includes("{{clube")))
    return "fechar";
  if (history.some((h) => h.toLowerCase().includes("k-rro")))
    return "mostrar_clube";
  if (history.length <= 2) return "abrir_gap";
  return "conectar_krro";
}

export async function strategize(
  message: string,
  history: string[]
): Promise<StrategyOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { type: fallbackStrategize(message, history) };
  }

  try {
    const historyContext = history.slice(-6).join("\n");
    const content = historyContext
      ? `Histórico:\n${historyContext}\n\nÚltima mensagem do motorista: ${message}`
      : `Primeira mensagem do motorista: ${message}`;

    const result = await callHaiku([
      { role: "system", content: STRATEGIST_PROMPT },
      { role: "user", content },
    ]);

    const match = result.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.type) return { type: parsed.type as StrategyType };
    }
  } catch {
    // falls through to fallback
  }

  return { type: fallbackStrategize(message, history) };
}

export function buildStrategyInstruction(type: StrategyType): string {
  switch (type) {
    case "saudacao":
      return "Apresente-se brevemente como ex-motorista e pergunte o nome do motorista.";
    case "abrir_gap":
      return "Crie curiosidade em 1 frase curta. Não explique ainda.";
    case "explorar_dor":
      return "Aprofunde a dor real do motorista sem exagero. Faça ele sentir que você entende.";
    case "ancorar_realidade":
      return "Corrija expectativa irreal de ganho com números reais de mercado.";
    case "conectar_krro":
      return "Conecte a dor identificada com a K-RRO em linguagem simples de colega.";
    case "responder_direto":
      return "Responda exatamente o que foi perguntado. Sem rodeio.";
    case "mostrar_clube":
      return `Envie exatamente: Deixa eu te mostrar o Clube K-RRO. {{CLUBE_KRRO}}`;
    case "fechar":
      return "Motorista confirmou interesse. Colete dados em ordem: nome completo → e-mail → WhatsApp com DDD → endereço → placa.";
  }
}
