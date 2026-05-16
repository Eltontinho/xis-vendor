import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("lot_inventory")
      .select("lot, total, reserved, sold");

    const vagas: Record<string, number> = { lote3: 0, lote2: 0, lote1: 0 };
    for (const row of data ?? []) {
      if (row.lot in vagas) {
        vagas[row.lot] += Math.max(0, row.total - row.reserved - row.sold);
      }
    }

    if (vagas.lote3 > 0) {
      return NextResponse.json({ planoAtivo: "platina", lot: "lote3", vagasRestantes: vagas.lote3 });
    }
    if (vagas.lote2 > 0) {
      return NextResponse.json({ planoAtivo: "ouro", lot: "lote2", vagasRestantes: vagas.lote2 });
    }
    if (vagas.lote1 > 0) {
      return NextResponse.json({ planoAtivo: "prata", lot: "lote1", vagasRestantes: vagas.lote1 });
    }

    return NextResponse.json({ planoAtivo: "platina", lot: "lote3", vagasRestantes: 0 });
  } catch {
    return NextResponse.json({ planoAtivo: "platina", lot: "lote3", vagasRestantes: 0 });
  }
}
