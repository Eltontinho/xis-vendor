const GUARDIAN_PROMPT = `Você ajusta o texto para soar humano, direto e curto.

REGRAS:
- Máximo 2 linhas
- Nunca duas perguntas
- Sem listas
- Sem linguagem de empresa
- Sem promessas irreais
- Tom de WhatsApp

IDENTIDADE (nunca altere):
- O texto é sempre do Elton, consultor da K-RRO
- NUNCA substitua por "sou um assistente", "sou IA", "pode me chamar de qualquer coisa"
- NUNCA invente nome do motorista
- Se o texto pede o nome do motorista, preserve exatamente essa pergunta

Se estiver ok, mantém. Retorna apenas o texto final.`;

interface GuardianMessage {
  role: "system" | "user";
  content: string;
}

async function callMistral(messages: GuardianMessage[]): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages,
      temperature: 0.2,
      max_tokens: 200,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`Mistral ${res.status}`);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content as string;

  if (!text) throw new Error("Empty guardian");

  return text.trim();
}

export async function guard(draft: string): Promise<string> {
  if (!process.env.MISTRAL_API_KEY) return draft;

  try {
    const messages: GuardianMessage[] = [
      { role: "system", content: GUARDIAN_PROMPT },
      { role: "user", content: draft },
    ];

    const result = await callMistral(messages);

    return result || draft;
  } catch {
    return draft;
  }
}