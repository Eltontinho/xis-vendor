import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, image, history } = await req.json();

    // Monta conteúdo da mensagem atual (texto + imagem opcional)
    const currentContent: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [
      { type: "text", text: message },
    ];

    if (image && typeof image === "string") {
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      currentContent.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64Data },
      });
    }

    // Histórico apenas com texto para evitar payload gigante
    const formattedHistory = (history as Array<{ role: string; content: string }>).map((msg) => ({
      role: msg.role === "elton" ? "assistant" : msg.role,
      content: [{ type: "text", text: msg.content }],
    }));

    const fullMessages = [...formattedHistory, { role: "user", content: currentContent }];

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
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt,
        messages: fullMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic Error:", errText);
      return NextResponse.json({ error: `API Error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ message: data.content[0].text });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
