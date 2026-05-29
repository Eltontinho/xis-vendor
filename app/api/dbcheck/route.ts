import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Tenta contar direto
  const { data, error } = await supabase.from("drivers").select("id").limit(1);

  // Verifica se a tabela existe via information_schema
  const { data: tables, error: tableErr } = await supabase
    .rpc("sql", { query: "SELECT count(*) FROM information_schema.tables WHERE table_name='drivers'" })
    .maybeSingle();

  return NextResponse.json({
    drivers_sample: data,
    drivers_error: error?.message ?? null,
    table_check: tables,
    table_check_error: tableErr?.message ?? null,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40),
    has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
