import { getLead, upsertLead } from "@/lib/elton/db";
import { LeadStage } from "@/lib/elton/state";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return Response.json({ history: [] });

  const lead = await getLead(phone);
  if (!lead) return Response.json({ history: [] });

  const history = typeof lead.history === "string"
    ? JSON.parse(lead.history)
    : lead.history ?? [];

  return Response.json({ history, stage: lead.stage });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return Response.json({ success: false, error: "phone obrigatório" }, { status: 400 });

  await upsertLead({
    phone,
    stage: "NOVO" as LeadStage,
    history: [],
    updatedAt: new Date().toISOString(),
  });

  return Response.json({ success: true });
}
