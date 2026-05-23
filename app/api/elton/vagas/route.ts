import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOTAL_LOTE1 = 200;

export async function GET() {
  const { count, error } = await supabase
    .from("lead_states")
    .select("*", { count: "exact", head: true })
    .eq("stage", "convertido");

  if (error) {
    return Response.json({ vagas: 0 }, { status: 500 });
  }

  const ocupadas = count ?? 0;
  const vagas = Math.max(TOTAL_LOTE1 - ocupadas, 0);

  return Response.json({ vagas }, {
    headers: { "Cache-Control": "no-store" },
  });
}
