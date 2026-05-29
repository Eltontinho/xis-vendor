import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, image, history } = await req.json();

    // Monta histórico no formato Gemini (role: "user" | "model")
    const contents: Array<{ role: string; parts: unknown[] }> = (history as Array<{ role: string; content: string }>).map((msg) => ({
      role: msg.role === "elton" || msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Monta a mensagem atual (texto + imagem opcional)
    const currentParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [
      { text: message },
    ];

    if (image && typeof image === "string") {
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      currentParts.push({ inline_data: { mime_type: "image/jpeg", data: base64Data } });
    }

    contents.push({ role: "user", parts: currentParts });

    const { getEltonSystemPrompt } = await import("@/lib/elton/system");
    const systemPrompt = getEltonSystemPrompt(199);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY || ""}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Error:", errText);
      return NextResponse.json({ error: `API Error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text as string;
    const t = reply.toLowerCase();

    let cardObj: { type: string } | null = null;
    if (/card de apresenta[çc]|cardk/.test(t)) {
      cardObj = { type: "apresentacao" };
    } else if (/conta de padaria|clube k-?rro|clube-todos/.test(t)) {
      cardObj = { type: "clube" };
    } else if (/platina/.test(t) && /fechar|garantir|vaga|confirmar|pagar/.test(t)) {
      cardObj = { type: "pagamento" };
    }

    return NextResponse.json({ message: reply, card: cardObj });

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
