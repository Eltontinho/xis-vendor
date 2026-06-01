import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { history, session_id, resultado } = await req.json();

    if (!history || !session_id) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // Usa Gemini para analisar a conversa
    const prompt = `Analise esta conversa de vendas e responda APENAS em JSON válido, sem markdown:
{
  "gancho": "o momento ou argumento que mais engajou o usuário (null se abandonou cedo)",
  "fuga": "o momento exato onde o usuário perdeu interesse ou parou (null se converteu)",
  "passo_final": número de 1 a 12 indicando em qual passo da sequência a conversa terminou,
  "resumo": "uma frase descrevendo o que aconteceu",
  "plano": "platina ou ouro ou prata ou null",
  "cidade": "cidade do motorista ou null",
  "veiculo": "modelo e ano do veículo ou null"
}

Conversa:
${history.map((m: {role: string; content: string}) => `${m.role}: ${m.content}`).join("\n")}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 512, temperature: 0 },
        }),
      }
    );

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const clean = raw.replace(/```json|```/g, "").trim();
    const insight = JSON.parse(clean);

    // Salva no Supabase
    await supabase.from("conversation_insights").insert({
      session_id,
      resultado: resultado ?? "abandonou",
      gancho:     insight.gancho,
      fuga:       insight.fuga,
      passo_final: insight.passo_final,
      resumo:     insight.resumo,
      plano:      insight.plano,
      cidade:     insight.cidade,
      veiculo:    insight.veiculo,
    });

    // Envia email com Resend
    if (process.env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "elton@k-rro.com",
          to: "eltonkrro@gmail.com",
          subject: `K-RRO | ${resultado === "converteu" ? "✅ CONVERSÃO" : resultado === "rejeitou" ? "❌ Rejeição" : "👻 Abandono"} — ${insight.cidade ?? "?"}`,
          html: `
            <h2>Resumo da Conversa</h2>
            <p><b>Resultado:</b> ${resultado}</p>
            <p><b>Resumo:</b> ${insight.resumo}</p>
            <p><b>Gancho:</b> ${insight.gancho ?? "—"}</p>
            <p><b>Fuga:</b> ${insight.fuga ?? "—"}</p>
            <p><b>Passo final:</b> ${insight.passo_final}</p>
            <p><b>Plano:</b> ${insight.plano ?? "—"}</p>
            <p><b>Cidade:</b> ${insight.cidade ?? "—"}</p>
            <p><b>Veículo:</b> ${insight.veiculo ?? "—"}</p>
          `,
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ANALYZE]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
