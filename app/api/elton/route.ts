import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    const formattedHistory = (history as Array<{ role: string; content: string }>).map((msg) => ({
      role: msg.role === "elton" ? "assistant" : "user",
      content: [{ type: "text", text: msg.content }],
    }));

    const { getEltonSystemPrompt } = await import("@/lib/elton/system");
    const systemPrompt = getEltonSystemPrompt(199);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt,
        messages: formattedHistory,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Anthropic Error:", errorData);
      return NextResponse.json(
        { message: `Erro na API: ${response.status}. Verifique a chave ANTHROPIC_API_KEY no Vercel.` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.content[0].text;
    return NextResponse.json({ message: reply });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ message: "Erro interno do servidor." }, { status: 500 });
  }
}
