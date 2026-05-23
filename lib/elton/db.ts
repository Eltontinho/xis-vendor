import { createClient } from "@supabase/supabase-js";
import { LeadStage } from "./state";
import { extractDDD } from "./extractor";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type Turn = { role: "user" | "assistant"; content: string };

export interface LeadProfile {
  phone:          string;
  ddd:            string | null;
  stage:          LeadStage;
  driver_name?:   string;
  city?:          string;
  vehicle_model?: string;
  vehicle_year?:  number;
  vehicle_cat?:   string;
  rides_per_day?: number;
  main_pain?:     string;
  intent_score:   number;
  plan_chosen?:   string;
  converted_at?:  string;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(phone: string): Promise<LeadProfile | null> {
  const { data } = await supabase
    .from("lead_profiles")
    .select("*")
    .eq("phone", phone)
    .single();
  return data ?? null;
}

export async function upsertProfile(profile: LeadProfile): Promise<void> {
  await supabase.from("lead_profiles").upsert({
    ...profile,
    ddd:        profile.ddd ?? extractDDD(profile.phone),
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone" });
}

export async function patchProfile(
  phone: string,
  updates: Partial<Omit<LeadProfile, "phone">>
): Promise<void> {
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, v]) => v !== null && v !== undefined)
  );
  if (Object.keys(cleanUpdates).length === 0) return;

  await supabase
    .from("lead_profiles")
    .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
    .eq("phone", phone);
}

// ─── History (janela deslizante) ──────────────────────────────────────────────

const MAX_TURNS = 8;

export async function getHistory(phone: string): Promise<Turn[]> {
  const { data } = await supabase
    .from("lead_history")
    .select("turns")
    .eq("phone", phone)
    .single();

  if (!data) return [];
  const turns = typeof data.turns === "string"
    ? JSON.parse(data.turns)
    : data.turns;
  return Array.isArray(turns) ? turns : [];
}

export async function saveHistory(phone: string, turns: Turn[]): Promise<void> {
  const window = turns.slice(-MAX_TURNS * 2);

  await supabase.from("lead_history").upsert({
    phone,
    turns:      window,
    updated_at: new Date().toISOString(),
  }, { onConflict: "phone" });
}

// ─── Vagas ────────────────────────────────────────────────────────────────────

export async function getVagasDisponiveis(lote: number = 1): Promise<number> {
  const { data } = await supabase
    .from("vagas_lote")
    .select("total, reservadas")
    .eq("lote", lote)
    .single();

  if (!data) return 0;
  return Math.max(0, data.total - data.reservadas);
}

export async function reservarVaga(lote: number, phone: string): Promise<boolean> {
  const { data } = await supabase.rpc("reservar_vaga", {
    p_lote:  lote,
    p_phone: phone,
  });
  return data === true;
}
