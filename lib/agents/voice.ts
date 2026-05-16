import { getEltonSystemPrompt } from "@/lib/elton/system";

const AXIS_SYSTEM_PROMPT = getEltonSystemPrompt(600);

interface VoiceMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const VOICE_BEHAVIOR = `REGRAS INVIOLÁVEIS:
Nunca invente dados que o motorista não disse.
Nunca fale de carro, cidade ou corrida como se fossem seus.
Se não foi dito na conversa, não assuma.
Máximo 2 linhas por mensagem.
Uma pergunta por vez.`;

function applyStrategyHint(type: string): string {
  switch (type) {
    case "abrir_gap":
      return "Faça uma pergunta que leve o motorista a pensar no quanto sobra limpo no fim do dia.";
    case "explorar_dor":
      return "Aprofunde a dor real de sobra baixa sem exagero.";
    case "ancorar_realidade":
      return "Corte expectativa irreal de ganho por hora com números reais de mercado.";
    case "conectar_krro":
      return "Conecte a dor com a K-RRO sem explicar demais.";
    case "responder_direto":
      return "Responda direto, sem rodeio.";
    case "mostrar_clube":
      return "Apresente o Clube K-RRO com o gatilho correto.";
    default:
      return "";
  }
}

/**
 * 🔥 EXTRAÇÃO REAL DA STRATEGY
 */
function extractStrategy(systemParts: string[]): string {
  const joined = systemParts.join(" ").toLowerCase();

  if (joined.includes("ancorar_realidade")) return "ancorar_realidade";
  if (joined.includes("mostrar_clube")) return "mostrar_clube";
  if (joined.includes("conectar_krro")) return "conectar_krro";
  if (joined.includes("responder_direto")) return "responder_direto";
  if (joined.includes("explorar_dor")) return "explorar_dor";
  if (joined.includes("abrir_gap")) return "abrir_gap";

  return "";
}

async function callDeepSeek(messages: VoiceMessage[]): Promise<string> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.85,
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content as string;
  if (!text) throw new Error("DeepSeek empty");
  return text;
}

async function callGroq(messages: VoiceMessage[]): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.85,
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content as string;
  if (!text) throw new Error("Groq empty");
  return text;
}

async function callGemini(messages: VoiceMessage[]): Promise<string> {
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemMsg =
    messages.find((m) => m.role === "system")?.content ?? "";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemMsg }] },
        contents,
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.85,
        },
      }),
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string;
  if (!text) throw new Error("Gemini empty");
  return text;
}

async function callHaiku(messages: VoiceMessage[]): Promise<string> {
  const systemMsg =
    messages.find((m) => m.role === "system")?.content ??
    AXIS_SYSTEM_PROMPT;

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
      max_tokens: 300,
      system: systemMsg,
      messages: conversation,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Haiku ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text as string;
  if (!text) throw new Error("Haiku empty");
  return text;
}

export async function generateVoice(
  systemParts: string[],
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  strategyType?: string
): Promise<string> {

  const resolved = strategyType ?? extractStrategy(systemParts);
  const strategyHint = applyStrategyHint(resolved);

  const combinedSystem = [
    AXIS_SYSTEM_PROMPT,
    VOICE_BEHAVIOR,
    strategyHint,
    ...systemParts,
  ].join("\n\n---\n\n");

  const messages: VoiceMessage[] = [
    { role: "system", content: combinedSystem },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userMessage },
  ];

  const providers = [
    () => callDeepSeek(messages),
    () => callGroq(messages),
    () => callGemini(messages),
    () => callHaiku(messages),
  ];

  for (const fn of providers) {
    try {
      return await fn();
    } catch (err) {
      console.warn("[voice fallback]", err);
    }
  }

  return "Tive um erro aqui. Manda de novo.";
}