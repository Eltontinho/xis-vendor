import { supabaseAdmin } from "@/lib/supabase";
import type { Classification } from "./classifier";

export interface ConversationContext {
  driverName: string | null;
  driverPhone: string | null;
  driverCity: string | null;
  driverProfile: Classification["profile"] | null;
  driverEmotion: Classification["emotion"] | null;
  driverTemperature: Classification["temperature"] | null;
  driverCommitment: Classification["commitment"] | null;
  riskFlag: boolean;
  reservedNumber: string | null;
  messageCount: number;
  lastClassification: Classification | null;
}

export function defaultContext(): ConversationContext {
  return {
    driverName: null,
    driverPhone: null,
    driverCity: null,
    driverProfile: null,
    driverEmotion: null,
    driverTemperature: null,
    driverCommitment: null,
    riskFlag: false,
    reservedNumber: null,
    messageCount: 0,
    lastClassification: null,
  };
}

export async function getConversationContext(
  conversationId: string | null
): Promise<ConversationContext> {
  if (!conversationId) return defaultContext();

  const { data } = await supabaseAdmin
    .from("vendor_conversations")
    .select(
      "driver_name, driver_phone, driver_city, driver_profile, driver_emotion, driver_temperature, driver_commitment, risk_flag, reserved_number, messages"
    )
    .eq("id", conversationId)
    .single();

  if (!data) return defaultContext();

  const messages = Array.isArray(data.messages) ? data.messages : [];

  const lastClassification: Classification | null = data.driver_temperature
    ? {
        temperature: data.driver_temperature as Classification["temperature"],
        emotion: (data.driver_emotion ?? "coldness") as Classification["emotion"],
        risk: "none",
        profile: (data.driver_profile ?? "intermediate") as Classification["profile"],
        commitment: (data.driver_commitment ?? "low") as Classification["commitment"],
      }
    : null;

  return {
    driverName: data.driver_name ?? null,
    driverPhone: data.driver_phone ?? null,
    driverCity: data.driver_city ?? null,
    driverProfile: (data.driver_profile as Classification["profile"]) ?? null,
    driverEmotion: (data.driver_emotion as Classification["emotion"]) ?? null,
    driverTemperature: (data.driver_temperature as Classification["temperature"]) ?? null,
    driverCommitment: (data.driver_commitment as Classification["commitment"]) ?? null,
    riskFlag: data.risk_flag ?? false,
    reservedNumber: data.reserved_number ?? null,
    messageCount: messages.length,
    lastClassification,
  };
}

export async function updateConversationProfile(
  conversationId: string,
  classification: Classification
): Promise<void> {
  await supabaseAdmin
    .from("vendor_conversations")
    .update({
      driver_profile: classification.profile,
      driver_emotion: classification.emotion,
      driver_temperature: classification.temperature,
      driver_commitment: classification.commitment,
    })
    .eq("id", conversationId);
}

export async function flagAsRisk(conversationId: string): Promise<void> {
  await supabaseAdmin
    .from("vendor_conversations")
    .update({ risk_flag: true })
    .eq("id", conversationId);
}
