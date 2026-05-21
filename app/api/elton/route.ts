import { callEltonAgent, ClaudeMessage } from "@/lib/elton/agent";
import { getLead, upsertLead, Lead } from "@/lib/elton/db";
import { LeadStage } from "@/lib/elton/state";

const MAX_HISTORY_TURNS = 8;

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
        blocked: true,
      });
    }

    console.log(`[ELTON] request — phone: ${phone}`);

    // Carrega histórico persistente
    const stored = await getLead(phone);
    let storedHistory: ClaudeMessage[] = [];
    if (stored) {
      try {
        const raw = typeof stored.history === "string"
          ? JSON.parse(stored.history as unknown as string)
          : stored.history;
        if (Array.isArray(raw)) storedHistory = raw as ClaudeMessage[];
      } catch { /* histórico corrompido — começa do zero */ }
    }

    const recentHistory = storedHistory.slice(-MAX_HISTORY_TURNS * 2);

    // Chama Claude Sonnet 4.6
    const replyText = await callEltonAgent({
      conversationId: phone,
      vagasLote1: vagas,
      history: [...recentHistory, { role: "user", content: message }],
    });

    // Persiste histórico atualizado
    const updatedLead: Lead = {
      phone,
      stage: stored?.stage ?? LeadStage.NOVO,
      history: [...recentHistory, { role: "user", content: message }, { role: "assistant", content: replyText }],
      channel: stored?.channel ?? "web",
      updatedAt: new Date().toISOString(),
    };
    await upsertLead(updatedLead);

    return Response.json({
      agent:   "ELTON",
      message: replyText,
    });
  } catch (err) {
    console.error("[ELTON] route error:", err);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
