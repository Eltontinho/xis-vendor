import { createClient } from "@supabase/supabase-js";
import { LeadStage } from "./state";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: "public" }, global: { headers: { "x-my-custom-header": "elton" } } }
);

export interface Lead {
  phone:     string;
  stage:     LeadStage;
  history:   { role: "user" | "assistant"; content: string }[];
  channel?:  "web" | "whatsapp";
  updatedAt: string;
}

export async function getLead(phone: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("lead_states")
    .select("*")
    .eq("phone", phone)
    .single();

  console.log(`[DB] raw data:`, JSON.stringify(data));
  console.log(`[DB] error:`, error?.message);

  return data ?? null;
}

export async function upsertLeadProfile(data: {
  telefone: string;
  nome?: string;
  cidade?: string;
  veiculo?: string;
}): Promise<void> {
  await supabase
    .from("leads")
    .upsert({ ...data, stage: "cadastro_pendente" }, { onConflict: "telefone" });
}

export async function upsertLead(lead: Lead): Promise<void> {
  const { error } = await supabase.from("lead_states").upsert({
    phone:     lead.phone,
    stage:     lead.stage,
    history:   JSON.stringify(lead.history),
    updatedAt: new Date().toISOString(),
  });
  if (error) console.error("[DB] upsertLead error:", error.message);
}
