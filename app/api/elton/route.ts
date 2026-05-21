import { NextRequest, NextResponse } from "next/server";
import { callEltonAgent, formatHistoryForClaude } from "@/lib/elton/agent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, history, conversationId, vagasLote1 } = await req.json();

    console.log("[/api/elton] Request received:", {
      hasMessage: !!message,
      hasHistory: Array.isArray(history),
      vagasLote1,
      conversationId: conversationId?.slice(0, 8) + "..."
    });

    console.log("[/api/elton] Env check:", {
      hasClaudeKey: !!process.env.CLAUDE_API_KEY,
      keyPrefix: process.env.CLAUDE_API_KEY?.slice(0, 10) + "...",
      keyLength: process.env.CLAUDE_API_KEY?.length,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });

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

    console.log("[/api/elton] Success, response length:", response.length);
    return NextResponse.json({ message: response });

  } catch (error) {
    console.error("=== ELTON ERROR DEBUG ===");
    console.error("Error name:", error instanceof Error ? error.name : "Unknown");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("Env CLAUDE_API_KEY exists:", !!process.env.CLAUDE_API_KEY);
    console.error("Env key length:", process.env.CLAUDE_API_KEY?.length);
    console.error("Env key prefix:", process.env.CLAUDE_API_KEY?.slice(0, 10) + "...");
    console.error("Node env:", process.env.NODE_ENV);
    console.error("Vercel env:", process.env.VERCEL_ENV);
    console.error("=== END DEBUG ===");

    return NextResponse.json(
      {
        message: "Problema técnico. Detalhes no log.",
        debug: process.env.NODE_ENV === "development" ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}
