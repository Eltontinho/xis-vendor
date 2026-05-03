import { NextRequest } from "next/server";
import { buscarPerola } from "@/lib/elton-memoria";
import { supabaseAdmin } from "@/lib/supabase";
import { ChatMessage } from "@/lib/types";
import { orchestrate } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, conversationId, history = [], driverCity, reservedNumber } = body as {
    message: string;
    conversationId?: string;
    history: { role: "user" | "assistant"; content: string }[];
    driverCity?: string;
    reservedNumber?: number;
  };

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "Mensagem vazia" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const perola = buscarPerola(message, driverCity);

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  (async () => {
    let convId = conversationId ?? null;

    try {
      const fullContent = await orchestrate(
        message,
        convId,
        history,
        { driverCity, reservedNumber, perola }
      );

      // Fake word-by-word streaming
      const words = fullContent.split(/(\s+)/);
      for (const chunk of words) {
        if (!chunk) continue;
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
        // Small delay between chunks to simulate typing
        await new Promise<void>((r) => setTimeout(r, 30));
      }

      // Persist to Supabase
      try {
        const userMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2, 9),
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        };
        const axisMsg: ChatMessage = {
          id: Math.random().toString(36).slice(2, 9),
          role: "axis",
          content: fullContent,
          timestamp: new Date().toISOString(),
        };

        if (!convId) {
          const { data } = await supabaseAdmin
            .from("vendor_conversations")
            .insert({ messages: [userMsg, axisMsg], current_state: "greeting" })
            .select("id")
            .single();
          if (data) convId = data.id as string;
        } else {
          const { data: existing } = await supabaseAdmin
            .from("vendor_conversations")
            .select("messages")
            .eq("id", convId)
            .single();
          if (existing) {
            const updated = [
              ...((existing.messages as ChatMessage[]) || []),
              userMsg,
              axisMsg,
            ];
            await supabaseAdmin
              .from("vendor_conversations")
              .update({ messages: updated })
              .eq("id", convId);
          }
        }
      } catch (e) {
        console.error("[/api/axis] supabase persist error", e);
      }
    } catch (e) {
      console.error("[/api/axis] orchestrate error", e);
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify("Ops, tive um problema técnico. Pode tentar novamente?")}\n\n`
        )
      );
    }

    try {
      await writer.write(
        encoder.encode(
          `data: [META]${JSON.stringify({ conversationId: convId })}\n\n`
        )
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
