import { eltonAgent } from "@/lib/elton/agent";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message: string = body.message?.trim();
    const phone:   string = body.phone?.trim();
    const vagas:   number = Number(body.vagas ?? 0);

    if (!message || !phone) {
      return Response.json(
        { error: "missing fields: message, phone" },
        { status: 400 }
      );
    }

    const OFENSIVO = ['negro', 'preto', 'viado', 'gay', 'bicha', 'raça', 'macaco', 'judeu', 'nazista', 'puta', 'vadia', 'mulher no volante', 'feminista'];
    const msgLower = message.toLowerCase();
    if (OFENSIVO.some(p => msgLower.includes(p))) {
      return Response.json({
        agent: 'ELTON',
        message: 'A K-RRO não compactua com esse tipo de comentário. Encerrando o atendimento.',
        stage: 'encerrado',
        blocked: true,
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
      ?? req.headers.get("x-real-ip")
      ?? phone;

    const LOCAL_TEST_IPS = ["::1", "127.0.0.1", "192.168.2.171"];
    const sessionKey = phone;

    console.log(`[ELTON] request — phone: ${phone} ip: ${ip} sessionKey: ${sessionKey}`);

    const result = await eltonAgent(message, sessionKey, vagas);

    return Response.json({
      agent:   "ELTON",
      message: result.message,
      stage:   result.stage,
      image:   result.image,
    });
  } catch (err) {
    console.error("[ELTON] route error:", err);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
