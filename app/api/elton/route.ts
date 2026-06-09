import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, image, history, session_id } = await req.json();

    // Converte histórico para formato Gemini
    const contents: Array<{ role: string; parts: unknown[] }> = (
      history as Array<{ role: string; content: string }>
    ).map((msg) => ({
      role: msg.role === "elton" || msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const currentParts: Array<{
      text?: string;
      inline_data?: { mime_type: string; data: string };
    }> = [{ text: message }];

    if (image && typeof image === "string") {
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      currentParts.push({
        inline_data: { mime_type: "image/jpeg", data: base64Data },
      });
    }

    contents.push({ role: "user", parts: currentParts });

    // Carrega o novo system prompt (sem argumento)
    const { getEltonSystemPrompt } = await import("@/lib/elton/system");
    const systemPrompt = getEltonSystemPrompt();

    // Chama Gemini com temperatura 0.3 (mais determinístico)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY || ""}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini Error:", errText);
      return NextResponse.json(
        { error: `API Error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text as string;

    // Limpeza simplificada: remove tags [CARD_*]
    const cleanReply = reply
      .replace(/\[CARD_[A-Z_:=|0-9.]+\]/g, "")
      .trim();

    // Detecta cards
    let cardObj: { type: string } | null = null;
    const isFirstMessage = (history || []).filter((m: { role: string }) => m.role === "user").length === 1;

    if (isFirstMessage) {
      cardObj = { type: "apresentacao" };
    } else if (reply.includes("[CARD_APRESENTACAO]")) {
      cardObj = { type: "apresentacao" };
    } else if (reply.includes("[CARD_CLUBE]")) {
      cardObj = { type: "clube" };
    } else if (reply.includes("[CARD_PAGAMENTO]")) {
      cardObj = { type: "pagamento" };
    }

    // Detecta confirmação de categoria e cria pré-cadastro (AGUARDA resposta)
    let registrationNumber: string | null = null;
    const categoriaMatch = reply.match(/categoria (GO|PLUS|EXEC|CARE)/i);

    if (categoriaMatch && session_id) {
      const categoria = categoriaMatch[1].toUpperCase();
      const historyText = (history || [])
        .map((m: { role: string; content: string }) => m.content)
        .join(" ");
      const anoMatch = historyText.match(/\b(20[2-9][0-9])\b/);
      const ano = anoMatch ? parseInt(anoMatch[1]) : null;
      const userMsgs = (history || []).filter(
        (m: { role: string }) => m.role === "user"
      );
      const ultimoModelo = userMsgs[userMsgs.length - 2]?.content || "";
      const nomeMatch = historyText.match(
        /(?:meu nome é|pode me chamar de|sou o|sou a)\s+([A-ZÀ-Ú][a-zà-ú]+)/i
      );
      const nome = nomeMatch ? nomeMatch[1] : null;

      try {
        const precadRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "https://axis-vendor.vercel.app"}/api/elton/precadastro`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              session_id,
              nome,
              cidade: null,
              veiculo_modelo: ultimoModelo,
              veiculo_ano: ano,
              veiculo_cat: categoria,
            }),
          }
        );

        if (precadRes.ok) {
          const precadData = await precadRes.json();
          registrationNumber = precadData.numero || null;
        }
      } catch (err) {
        console.error("Precadastro error:", err);
      }
    }

    // Detecta confirmação de dados e gera link de pagamento
    let checkoutUrl: string | null = null;
    const isConfirmacao = /tudo certo|aqui está seu link|vaga de fundador.*link|link.*fundador/i.test(cleanReply);

    if (isConfirmacao) {
      const histAll = (history || [])
        .map((m: { role: string; content: string }) => m.content)
        .join(" ")
        .toLowerCase();

      let lot: "lote3" | "lote2" | "lote1" = "lote3";
      if (/\bouro\b/.test(histAll)) lot = "lote2";
      else if (/\bprata\b/.test(histAll)) lot = "lote1";

      const phoneMatch = histAll.match(/(\d{10,11})/);
      const phone = phoneMatch ? phoneMatch[1] : "";
      const nameMatch = cleanReply.match(/nome:\s*([^\n]+)/i);
      const name = nameMatch ? nameMatch[1].trim() : "";
      const cityMatch = cleanReply.match(/cidade:\s*([^\n]+)/i);
      const city = cityMatch ? cityMatch[1].trim() : "";

      try {
        const reserveRes = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "https://axis-vendor.vercel.app"}/api/reserve`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lot,
              conversation_id: session_id || "elton-chat",
              driver_phone: phone,
              driver_name: name,
              driver_city: city,
            }),
          }
        );

        const reserveData = await reserveRes.json();
        if (reserveData.success && reserveData.checkout_url) {
          checkoutUrl = reserveData.checkout_url;
        }
      } catch {
        // silently fail
      }
    }

    // Fragmenta resposta: split por newlines, filtra vazias
    const fragments = cleanReply
      .split(/\n+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    // Adiciona número de pré-cadastro se gerado
    if (registrationNumber) {
      fragments.push(`📋 Seu número pré-cadastro: ${registrationNumber}`);
    }

    return NextResponse.json({ messages: fragments, card: cardObj, checkoutUrl });
  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
