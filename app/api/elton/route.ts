import { NextRequest, NextResponse } from "next/server";
import { callEltonAgent, formatHistoryForClaude } from "@/lib/elton/agent";

export async function POST(req: NextRequest) {
  try {
    const { message, history, conversationId, vagasLote1 } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    }

    const formattedHistory = formatHistoryForClaude(history || []);
    const fullHistory = [...formattedHistory, { role: "user" as const, content: message }];

    const response = await callEltonAgent({
      conversationId,
      vagasLote1: vagasLote1 || 199,
      history: fullHistory,
    });

    return NextResponse.json({ message: response });

  } catch (error) {
    console.error("[/api/elton] FULL ERROR:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        hasKey: !!process.env.CLAUDE_API_KEY,
        keyLength: process.env.CLAUDE_API_KEY?.length,
        model: process.env.MODEL_NAME || "not-set"
      }
    });
    return NextResponse.json(
      { message: "Problema técnico momentâneo. Tente novamente." },
      { status: 500 }
    );
  }
}
