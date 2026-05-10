import { getLead } from "@/lib/elton/db";

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
