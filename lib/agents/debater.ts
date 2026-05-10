interface DebateInput {
  draft: string;
  userMessage: string;
}

interface JudgeResult {
  approve: boolean;
  reason?: string;
}

async function judgeHumano(draft: string): Promise<JudgeResult> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `Você julga se uma mensagem soa humana, como um ex-motorista falando com um colega.
REPROVA se: parecer robô, usar bullet points, tiver mais de 2 linhas, soar corporativo, usar "plataforma" ou "solução".
Retorne APENAS: {"approve":true} ou {"approve":false,"reason":"motivo curto"}`,
        },
        { role: "user", content: draft },
      ],
      temperature: 0.1,
      max_tokens: 60,
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Groq judge ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[^}]+\}/);
  return match ? JSON.parse(match[0]) : { approve: true };
}

async function judgeForça(draft: string): Promise<JudgeResult> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: `Você julga se uma mensagem força venda ou pressiona o motorista.
REPROVA se: usar urgência artificial, prometer ganho sem base, prometer que "uma equipe vai entrar em contato", inventar número de vaga ou número da sorte antes da hora.
Retorne APENAS: {"approve":true} ou {"approve":false,"reason":"motivo curto"}`,
        },
        { role: "user", content: draft },
      ],
      temperature: 0.1,
      max_tokens: 60,
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Mistral judge ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[^}]+\}/);
  return match ? JSON.parse(match[0]) : { approve: true };
}

async function judgeTom(draft: string): Promise<JudgeResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: `Você julga se o tom da mensagem é adequado — direto, respeitoso, de colega para colega.
REPROVA se: tom for condescendente, paternalista, excessivamente formal, ou usar gírias forçadas.
Retorne APENAS: {"approve":true} ou {"approve":false,"reason":"motivo curto"}`,
          }],
        },
        contents: [{ role: "user", parts: [{ text: draft }] }],
        generationConfig: { maxOutputTokens: 60, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(6000),
    }
  );
  if (!res.ok) throw new Error(`Gemini judge ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const match = text.match(/\{[^}]+\}/);
  return match ? JSON.parse(match[0]) : { approve: true };
}

function ruleBasedCheck(draft: string, userMessage: string): string | null {
  const t = draft.toLowerCase();

  if (
    (t.includes("garante") && (t.includes("/h") || t.includes("por hora"))) ||
    t.includes("200/h") ||
    t.includes("200 por hora")
  ) {
    return "200/h direto não existe.\nNum dia bom dá 80~100… mas não o dia inteiro.";
  }

  if (
    t.includes("uma equipe vai entrar em contato") ||
    t.includes("enviei no e-mail") ||
    t.includes("entraremos em contato")
  ) {
    return draft
      .replace(/uma equipe.*?\./gi, "")
      .replace(/enviei no e-mail.*?\./gi, "")
      .trim();
  }

  return null;
}

export async function debate({ draft, userMessage }: DebateInput): Promise<string> {
  const ruled = ruleBasedCheck(draft, userMessage);
  if (ruled) return ruled;

  if (!process.env.GROQ_API_KEY && !process.env.MISTRAL_API_KEY && !process.env.GEMINI_API_KEY) {
    return draft;
  }

  try {
    const judges = await Promise.allSettled([
      judgeHumano(draft),
      judgeForça(draft),
      judgeTom(draft),
    ]);

    for (const result of judges) {
      if (result.status === "fulfilled" && !result.value.approve) {
        return draft
          .replace(/\bbullet\b.*$/gim, "")
          .replace(/^[-•]\s/gm, "")
          .split("\n")
          .slice(0, 2)
          .join("\n")
          .trim();
      }
    }
  } catch {
    // se todos os judges falharem, retorna o draft original
  }

  return draft;
}
