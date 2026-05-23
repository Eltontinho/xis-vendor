import { NextRequest } from "next/server";
import { validateSecret } from "@/lib/elton/security";
import { getVagasDisponiveis } from "@/lib/elton/db";

export async function GET(req: NextRequest) {
  if (!validateSecret(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const vagas = await getVagasDisponiveis(1);
  return Response.json({ vagas }, {
    headers: { "Cache-Control": "public, max-age=30" },
  });
}
