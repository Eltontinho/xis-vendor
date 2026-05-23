import OpenAI from "openai";
import { getEltonSystemPrompt } from "./system";
import { getProfile, upsertProfile, getHistory, saveHistory, getVagasDisponiveis } from "./db";
import { validateEltonOutput, ELTON_FALLBACK } from "./validator";
import { extractDDD, extractProfileUpdates } from "./extractor";
import { extractNameAndVehicle } from "./compressor";
import { detectIntent, getNextStage, LeadStage } from "./state";
import type { LeadProfile, Turn } from "./db";

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey:  process.env.DEEPSEEK_API_KEY!,
});

export interface EltonResult {
  message: string;
  stage:   LeadStage;
  vagas:   number;
}

export async function eltonAgent(
  message: string,
  phone:   string
): Promise<EltonResult> {
  const [profile, history, vagas] = await Promise.all([
    getProfile(phone),
    getHistory(phone),
    getVagasDisponiveis(1),
  ]);

  const systemPrompt = getEltonSystemPrompt(vagas);

  const turns: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...history.map((t: Turn) => ({
      role:    t.role as "user" | "assistant",
      content: t.content,
    })),
    { role: "user" as const, content: message },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let rawReply = "";
  try {
    const completion = await deepseek.chat.completions.create(
      {
        model:       "deepseek-chat",
        max_tokens:  512,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          ...turns,
        ],
      },
      { signal: controller.signal }
    );
    rawReply = completion.choices[0]?.message?.content?.trim() ?? "";
  } finally {
    clearTimeout(timeout);
  }

  const reply = validateEltonOutput(rawReply) ? rawReply : ELTON_FALLBACK;

  await saveHistory(phone, [
    ...history,
    { role: "user",      content: message },
    { role: "assistant", content: reply   },
  ] as Turn[]);

  const intent       = detectIntent(message);
  const currentStage = profile?.stage ?? LeadStage.NOVO;
  const nextStage    = getNextStage(currentStage, intent);
  const intentScore  = Math.max(0, (profile?.intent_score ?? 0) + (intent === "buy" ? 1 : intent === "objection" ? -1 : 0));

  const profileBase: LeadProfile = {
    phone,
    ddd:          profile?.ddd ?? extractDDD(phone),
    stage:        nextStage,
    intent_score: intentScore,
  };

  await upsertProfile(profile ? { ...profile, ...profileBase } : profileBase);

  // Non-blocking enrichment
  Promise.all([
    (async () => {
      const extracted = extractProfileUpdates(message + " " + reply);
      if (Object.keys(extracted).length > 0) {
        const { patchProfile } = await import("./db");
        await patchProfile(phone, extracted);
      }
    })(),
    (async () => {
      if (!profile?.driver_name || !profile?.vehicle_model) {
        const snippet  = history.slice(-4).map(t => t.content).join(" ") + " " + message;
        const enriched = await extractNameAndVehicle(snippet);
        if (enriched.driver_name || enriched.vehicle_model) {
          const { patchProfile } = await import("./db");
          await patchProfile(phone, {
            driver_name:   enriched.driver_name,
            vehicle_model: enriched.vehicle_model,
          });
        }
      }
    })(),
  ]).catch(() => {});

  return { message: reply, stage: nextStage, vagas };
}
