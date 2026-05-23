import { NextRequest, NextResponse } from "next/server";
import { getEltonSystemPrompt } from "@/lib/elton/system";

export const maxDuration = 60;

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1024;

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | unknown[];
};

function formatHistory(
  history: Array<{ role: string; content: string }>
): ClaudeMessage[] {
  return (history || [])
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
}

async function callClaude(messages: ClaudeMessage[], systemPrompt: string, maxTokens = MAX_TOKENS): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Claude API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = Array.isArray(data.content)
    ? data.content.map((b: { text?: string }) => b.text || "").join("")
    : data.content || "";
  return content.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { message, history, conversationId, vagasLote1, image } = await req.json();

    console.log("[/api/elton] Request received:", {
      hasMessage: !!message,
      hasHistory: Array.isArray(history),
      hasImage: !!image,
      vagasLote1,
      conversationId: conversationId?.slice(0, 8) + "...",
    });

    console.log("[/api/elton] Env check:", {
      hasClaudeKey: !!process.env.ANTHROPIC_API_KEY,
      keyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 10) + "...",
      keyLength: process.env.ANTHROPIC_API_KEY?.length,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
    }

    const systemPrompt = getEltonSystemPrompt(vagasLote1 || 199);
    const formattedHistory = formatHistory(history || []);

    // Constrói conteúdo da mensagem do usuário (texto + imagem opcional)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [];

    if (image?.data) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mimeType || "image/jpeg",
          data: image.data,
        },
      });
    }

    if (message) {
      userContent.push({ type: "text", text: message });
    }

    const newMessage = { role: "user" as const, content: userContent };
    const messages: ClaudeMessage[] = [...formattedHistory, newMessage];
    // Visão usa mais tokens para análise detalhada
    const maxTokens = image?.data ? 2048 : MAX_TOKENS;
    const response = await callClaude(messages, systemPrompt, maxTokens);

    console.log("[/api/elton] Success, response length:", response.length);
    return NextResponse.json({ message: response });

  } catch (error) {
    console.error("=== ELTON ERROR DEBUG ===");
    console.error("Error name:", error instanceof Error ? error.name : "Unknown");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("Env ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
    console.error("Env key length:", process.env.ANTHROPIC_API_KEY?.length);
    console.error("Env key prefix:", process.env.ANTHROPIC_API_KEY?.slice(0, 10) + "...");
    console.error("Node env:", process.env.NODE_ENV);
    console.error("Vercel env:", process.env.VERCEL_ENV);
    console.error("=== END DEBUG ===");

    return NextResponse.json(
      {
        message: "Problema técnico. Detalhes no log.",
        debug: process.env.NODE_ENV === "development" ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
