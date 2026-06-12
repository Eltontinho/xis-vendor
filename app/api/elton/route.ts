import { NextRequest, NextResponse } from "next/server";
import { getPlanoAtual, LINKS_PAGAMENTO, LINKS_GRUPO, PLATINA_VAGAS, OURO_VAGAS, PRATA_VAGAS } from "@/lib/elton/vagas";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { message, image, history, session_id } = await req.json();

    // Carrega o system prompt com contexto dinâmico de vagas
    const { getEltonSystemPrompt } = await import("@/lib/elton/system");
    const planoAtual = getPlanoAtual();
    const vagasRestantes = planoAtual === "platina" ? PLATINA_VAGAS : planoAtual === "ouro" ? OURO_VAGAS : planoAtual === "prata" ? PRATA_VAGAS : 0;
    const linkPagamento = planoAtual === "esgotado" ? "" : LINKS_PAGAMENTO[planoAtual];
    const systemPrompt = getEltonSystemPrompt(199, planoAtual, linkPagamento, vagasRestantes, LINKS_GRUPO);

    // Monta mensagens no formato OpenAI
    const oaMessages: Array<{ role: string; content: unknown }> = [
      { role: "system", content: systemPrompt },
      ...(history as Array<{ role: string; content: string }>).map((msg) => ({
        role: msg.role === "elton" || msg.role === "assistant" ? "assistant" : "user",
        content: msg.content,
      })),
    ];

    // Mensagem atual (com ou sem imagem)
    if (image && typeof image === "string") {
      const dataUrl = image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
      oaMessages.push({
        role: "user",
        content: [
          { type: "text", text: message },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      });
    } else {
      oaMessages.push({ role: "user", content: message });
    }

    // Chama OpenAI gpt-4o-mini
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: "gpt-5",
        messages: oaMessages,
        max_completion_tokens: 1024,
        reasoning_effort: "minimal",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI Error:", errText);
      return NextResponse.json(
        { error: `API Error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content as string;

    // Remove tags [CARD_*] e frases duplicadas que o frontend já exibe no card
    const cleanReply = reply
      .replace(/\[CARD_[A-Za-z_:=|0-9.]+\]/gi, "")
      .replace(/[^\n]*(?:chamou aten|viu até agora|viu ate agora|faz sentido pra voc|o que achou)[^\n]*/gi, "")
      .trim();

    // Detecta cards (case-insensitive para robustez com variações do modelo)
    let cardObj: { type: string } | null = null;

    if (/\[CARD_CLUBE\]/i.test(reply)) {
      cardObj = { type: "clube" };
    } else if (/\[CARD_PAGAMENTO\]/i.test(reply)) {
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

    // Fragmenta resposta: primeiro por \n+, depois por sentença dentro de cada parágrafo
    // Lookahead em maiúscula/aspas evita quebrar abreviações como R$, ex:, nº
    const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-ZÀ-Ú"])/;
    let fragments = cleanReply
      .split(/\n+/)
      .flatMap((para) => para.split(SENTENCE_SPLIT))
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    // Quando um card foi emitido, remove linhas que repetem a pergunta do card
    if (cardObj) {
      fragments = fragments.filter(
        (f) => !/o que te chamou|qual benefício|qual dessas opções/i.test(f)
      );
    }

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
