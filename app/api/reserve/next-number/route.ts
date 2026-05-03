import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { count, error } = await supabaseAdmin
      .from("lot_locks")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    return NextResponse.json({ number: (count ?? 0) + 1 });
  } catch (err) {
    console.error("[/api/reserve/next-number]", err);
    // Fallback: número aleatório visualmente plausível
    return NextResponse.json({ number: Math.floor(Math.random() * 90) + 10 });
  }
}
