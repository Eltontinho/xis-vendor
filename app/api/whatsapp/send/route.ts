import { sendMessage } from "@/lib/whatsapp/client";

export async function POST(req: Request) {
  const body = await req.json();
  const { phone, message } = body as { phone?: string; message?: string };

  if (!phone || !message) {
    return Response.json({ error: "missing phone or message" }, { status: 400 });
  }

  await sendMessage(phone, message);
  return Response.json({ sent: true });
}
