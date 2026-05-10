const GUARDIAN_PROMPT = `Corrija para ficar humano e direto.

REGRAS:
- Máx 2 linhas
- Sem 2 perguntas
- Sem lista
- Sem enrolação

Se não estiver avançando a conversa → reescreva para avançar

Retorne só o texto.`;

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