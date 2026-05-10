export interface Classification {
  temperature: "cold" | "warm" | "hot";
  risk: "none" | "high";
  persona: "direct" | "confused" | "apathetic" | "skeptic" | "problematic";
}

const DEFAULT: Classification = {
  temperature: "cold",
  risk: "none",
  persona: "direct",
};

const CLASSIFIER_PROMPT = `Você é um classificador de mensagens de motoristas de app. Analise e retorne JSON.

Campos:
- temperature: "cold" (indiferente/neutro), "warm" (interessado), "hot" (quer comprar/fechar)
- risk: "none" ou "high" (ofensa, agressão, preconceito)
- persona: "direct" (objetivo), "confused" (não entende), "apathetic" (não demonstra interesse), "skeptic" (desconfia), "problematic" (agressivo/ofensivo)

Retorne APENAS o JSON, sem explicação. Exemplo:
{"temperature":"warm","risk":"none","persona":"skeptic"}`;

async function callGroq(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.1,
      max_tokens: 60,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Groq classifier ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function fallbackClassify(message: string): Classification {
  const t = message.toLowerCase();
  if (["idiota", "lixo", "merda", "viado", "preto"].some((w) => t.includes(w)))
    return { temperature: "cold", risk: "high", persona: "problematic" };
  if (["quero", "como pago", "manda link", "fechar"].some((w) => t.includes(w)))
    return { temperature: "hot", risk: "none", persona: "direct" };
  if (["garante", "verdade", "duvido", "é golpe"].some((w) => t.includes(w)))
    return { temperature: "warm", risk: "none", persona: "skeptic" };
  if (["como funciona", "não entendi", "nao entendi", "explica"].some((w) => t.includes(w)))
    return { temperature: "cold", risk: "none", persona: "confused" };
  if (t.trim().split(" ").length <= 2)
    return { temperature: "cold", risk: "none", persona: "apathetic" };
  return DEFAULT;
}

export async function classify(
  message: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<Classification> {
  if (!process.env.GROQ_API_KEY) return fallbackClassify(message);

  try {
    const lastMsgs = history
      .slice(-4)
      .map((h) => `${h.role}: ${h.content}`)
      .join("\n");
    const content = lastMsgs
      ? `Histórico recente:\n${lastMsgs}\n\nMensagem atual: ${message}`
      : message;

    const result = await callGroq([
      { role: "system", content: CLASSIFIER_PROMPT },
      { role: "user", content },
    ]);

    const match = result.match(/\{[^}]+\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.temperature && parsed.risk && parsed.persona) {
        return parsed as Classification;
      }
    }
  } catch {
    // falls through to fallback
  }

  return fallbackClassify(message);
}
