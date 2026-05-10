import { NextRequest } from "next/server";
import { buscarPerola } from "@/lib/elton-memoria";
import { supabaseAdmin } from "@/lib/supabase";
import { ChatMessage } from "@/lib/types";
import { orchestrate } from "@/lib/agents/orchestrator";

export const runtime = "nodejs";

// Groups text into sentence-level chunks. Each chunk is flushed as one SSE event.
// Merges fragments until we have ≥ MIN_WORDS and a sentence terminator.
const MIN_WORDS = 3;
const STALE_MS = 3000;
const SENTENCE_RE = /[^.!?\n]*[.!?\n]+/g;

function toSentenceChunks(text: string): string[] {
  SENTENCE_RE.lastIndex = 0;
  const raw: string[] = [];
  let m: RegExpExecArray | null;
  let lastIndex = 0;

  while ((m = SENTENCE_RE.exec(text)) !== null) {
    raw.push(m[0]);
    lastIndex = SENTENCE_RE.lastIndex;
  }
  if (lastIndex < text.length) raw.push(text.slice(lastIndex));

  const result: string[] = [];
  let acc = "";
  for (const part of raw) {
    acc += part;
    if (acc.trim().split(/\s+/).filter(Boolean).length >= MIN_WORDS) {
      result.push(acc);
      acc = "";
    }
  }
  if (acc.trim()) result.push(acc);
  return result.filter((s) => s.trim().length > 0);
}

// Delay proportional to chunk length (~35ms/word, capped at 400ms)
function chunkDelay(chunk: string): number {
  const words = chunk.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(words * 35, 400);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    message,
    conversationId,
    history = [],
    driverCity,
    reservedNumber,
  } = body as {
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
    let streamClosed = false;
    let watchdog: ReturnType<typeof setInterval> | null = null;

    async function closeStream() {
      if (streamClosed) return;
      streamClosed = true;
      if (watchdog) clearInterval(watchdog);
      try {
        await writer.write(
          encoder.encode(
            `data: [META]${JSON.stringify({ conversationId: convId })}\n\n`
          )
        );
      } catch {}
      try {
        await writer.close();
      } catch {}
    }

    try {
      const fullContent = await orchestrate({
        message,
        conversationId: convId,
        history,
        driverCity: driverCity ?? null,
        reservedNumber: reservedNumber ?? undefined,
        perola: perola ?? null,
      });

      const chunks = toSentenceChunks(fullContent);
      let lastWriteAt = Date.now();

      // Watchdog: flush + close if stream stalls for > STALE_MS
      watchdog = setInterval(async () => {
        if (!streamClosed && Date.now() - lastWriteAt > STALE_MS) {
          await closeStream();
        }
      }, 500);

      for (const chunk of chunks) {
        if (streamClosed) break;
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
        lastWriteAt = Date.now();
        await new Promise<void>((r) => setTimeout(r, chunkDelay(chunk)));
      }

      if (watchdog) clearInterval(watchdog);

      if (!streamClosed) {
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

        await closeStream();
      }
    } catch (e) {
      console.error("[/api/axis] orchestrate error", e);
      if (!streamClosed) {
        try {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify(
                "Ops, tive um problema técnico. Pode tentar novamente?"
              )}\n\n`
            )
          );
        } catch {}
        await closeStream();
      }
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
