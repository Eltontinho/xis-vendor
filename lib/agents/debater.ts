interface DebateVote {
  approved: boolean;
  reason: string;
  suggestion?: string;
}

interface DebateResult {
  approved: boolean;
  feedback: string;
  revisedDraft?: string;
}

async function judgeHuman(draft: string, context: string): Promise<DebateVote> {
  if (!process.env.GROQ_API_KEY) return { approved: true, reason: "skip" };
  try {
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
            content: `Você avalia se uma mensagem de chat soa humana e natural.
Responda APENAS com JSON: { "approved": true/false, "reason": "motivo em 1 frase", "suggestion": "sugestão se reprovado" }
Reprove se: parece robô, usa frases prontas de call center, é longa demais, tem bullet points, tem duas perguntas, soa forçado ou artificial.
Aprove se: parece uma pessoa real conversando no WhatsApp, é curta, direta, natural.`,
          },
          { role: "user", content: `Contexto: ${context}\n\nMensagem: ${draft}` },
        ],
        temperature: 0.1,
        max_tokens: 150,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { approved: true, reason: "skip" };
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return {
      approved: parsed.approved ?? true,
      reason: parsed.reason ?? "",
      suggestion: parsed.suggestion,
    };
  } catch {
    return { approved: true, reason: "skip" };
  }
}

async function judgeForcing(draft: string, context: string): Promise<DebateVote> {
  if (!process.env.MISTRAL_API_KEY) return { approved: true, reason: "skip" };
  try {
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
            content: `Você avalia se uma mensagem está forçando venda ou sendo agressiva comercialmente.
Responda APENAS com JSON: { "approved": true/false, "reason": "motivo em 1 frase", "suggestion": "sugestão se reprovado" }
Reprove se: menciona preço sem o motorista perguntar, cria urgência falsa, insiste após recusa, usa gatilhos de pressão excessivos.
Aprove se: é natural, respeita o ritmo do motorista, não empurra produto.`,
          },
          { role: "user", content: `Contexto: ${context}\n\nMensagem: ${draft}` },
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { approved: true, reason: "skip" };
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      approved: parsed.approved ?? true,
      reason: parsed.reason ?? "",
      suggestion: parsed.suggestion,
    };
  } catch {
    return { approved: true, reason: "skip" };
  }
}

async function judgeTone(draft: string, persona: string): Promise<DebateVote> {
  if (!process.env.GEMINI_API_KEY) return { approved: true, reason: "skip" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: `Você avalia se o tom de uma mensagem está adequado para o perfil do motorista.
Responda APENAS com JSON válido: { "approved": true/false, "reason": "motivo em 1 frase", "suggestion": "sugestão se reprovado" }
Perfil do motorista: ${persona}
Reprove se: tom errado para o perfil, muito formal para veterano, muito técnico para confuso, muito frio para inseguro.
Aprove se: tom adequado ao perfil detectado.`
            }]
          },
          contents: [{ role: "user", parts: [{ text: `Mensagem: ${draft}` }] }],
          generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { approved: true, reason: "skip" };
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      approved: parsed.approved ?? true,
      reason: parsed.reason ?? "",
      suggestion: parsed.suggestion,
    };
  } catch {
    return { approved: true, reason: "skip" };
  }
}

export async function debate(
  draft: string,
  context: string,
  persona: string
): Promise<DebateResult> {
  // Roda os 3 juízes em paralelo
  const [humanVote, forcingVote, toneVote] = await Promise.all([
    judgeHuman(draft, context),
    judgeForcing(draft, context),
    judgeTone(draft, persona),
  ]);

  const votes = [humanVote, forcingVote, toneVote];
  const approved = votes.every(v => v.approved);

  if (approved) {
    return { approved: true, feedback: "aprovado pelos 3 juízes" };
  }

  // Coleta feedback dos que reprovaram
  const feedback = votes
    .filter(v => !v.approved)
    .map(v => v.suggestion ?? v.reason)
    .join(" | ");

  return {
    approved: false,
    feedback,
  };
}
