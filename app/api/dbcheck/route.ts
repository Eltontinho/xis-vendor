import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { count, error } = await supabase.from("drivers").select("*", { count: "exact", head: true });
  return NextResponse.json({ count, error: error?.message ?? null });
}
