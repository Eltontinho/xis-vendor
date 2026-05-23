import OpenAI from "openai";

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey:  process.env.DEEPSEEK_API_KEY!,
});

export function classifyVehicle(
  model: string,
  year: number
): "go" | "plus" | "luxo" | "reprovado" {
  if (year < 2018) return "reprovado";

  const m = model.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const luxo = ["cruze","corolla","sw4","compass","jeep","bmw","mercedes","audi","volvo","tiguan","hilux","tucson","xc60"];
  const plus = ["virtus highline","onix premier","t-cross","polo highline","hb20s platinum","cronos precision"];

  if (luxo.some(v => m.includes(v))) return "luxo";
  if (plus.some(v => m.includes(v))) return "plus";
  return "go";
}

export async function extractNameAndVehicle(
  conversationSnippet: string
): Promise<{ driver_name?: string; vehicle_model?: string }> {
  try {
    const res = await deepseek.chat.completions.create({
      model:       "deepseek-chat",
      temperature: 0,
      max_tokens:  80,
      messages: [{
        role: "user",
        content: `
Extraia do texto abaixo APENAS:
- nome do motorista (primeiro nome, se mencionado)
- modelo do carro (ex: "Onix 2022", "HB20", "Virtus")

Responda SOMENTE em JSON: {"driver_name":"...","vehicle_model":"..."}
Se não encontrar, omita o campo.

Texto:
${conversationSnippet.slice(0, 800)}
        `.trim(),
      }],
    });

    const raw = res.choices?.[0]?.message?.content ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {};
  }
}
