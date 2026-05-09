import { supabaseAdmin } from "@/lib/supabase";
import type { Classification } from "./classifier";

export interface ConversationContext {
  driverName: string | null;
  driverPhone: string | null;
  driverCity: string | null;
  driverTemperature: Classification["temperature"] | null;
  driverPersona: Classification["persona"] | null;
  riskFlag: boolean;
  reservedNumber: string | null;
  messageCount: number;
  lastClassification: Classification | null;
  channel: "web" | "whatsapp";
}

export function defaultContext(): ConversationContext {
  return {
    driverName: null,
    driverPhone: null,
    driverCity: null,
    driverTemperature: null,
    driverPersona: null,
    riskFlag: false,
    reservedNumber: null,
    messageCount: 0,
    lastClassification: null,
    channel: "web",
  };
}

export async function getConversationContext(
  conversationId: string | null
): Promise<ConversationContext> {
  if (!conversationId) return defaultContext();

  const { data } = await supabaseAdmin
    .from("vendor_conversations")
    .select(
      "driver_name, driver_phone, driver_city, driver_temperature, driver_profile, risk_flag, reserved_number, messages, channel"
    )
    .eq("id", conversationId)
    .single();

  if (!data) return defaultContext();

  const messages = Array.isArray(data.messages) ? data.messages : [];

  const lastClassification: Classification | null = data.driver_temperature
    ? {
        temperature: data.driver_temperature as Classification["temperature"],
        risk: "none",
        persona: (data.driver_profile ?? "direct") as Classification["persona"],
      }
    : null;

  return {
    driverName: data.driver_name ?? null,
    driverPhone: data.driver_phone ?? null,
    driverCity: data.driver_city ?? null,
    driverTemperature:
      (data.driver_temperature as Classification["temperature"]) ?? null,
    driverPersona:
      (data.driver_profile as Classification["persona"]) ?? null,
    riskFlag: data.risk_flag ?? false,
    reservedNumber: data.reserved_number ?? null,
    messageCount: messages.length,
    lastClassification,
    channel: (data.channel as "web" | "whatsapp") ?? "web",
  };
}

export async function updateConversationProfile(
  conversationId: string,
  classification: Classification
): Promise<void> {
  await supabaseAdmin
    .from("vendor_conversations")
    .update({
      driver_temperature: classification.temperature,
      driver_profile: classification.persona,
    })
    .eq("id", conversationId);
}

export async function flagAsRisk(conversationId: string): Promise<void> {
  await supabaseAdmin
    .from("vendor_conversations")
    .update({ risk_flag: true })
    .eq("id", conversationId);
}
