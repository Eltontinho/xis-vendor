import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_PASSWORD = "eltondeoliveirak-rro@Jaelpicoe2429$$";

export async function POST(req: NextRequest) {
  try {
    const { message, password } = await req.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Busca dados do banco para contexto
    const [drivers, insights, vagas] = await Promise.all([
      supabase.from("drivers").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("conversation_insights").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("vagas_lote").select("*"),
    ]);

    const context = `
DADOS ATUAIS DO BANCO K-RRO (${new Date().toLocaleString("pt-BR")}):

MOTORISTAS CADASTRADOS (${drivers.data?.length ?? 0} registros):
${JSON.stringify(drivers.data, null, 2)}

INSIGHTS DE CONVERSAS (${insights.data?.length ?? 0} registros):
${JSON.stringify(insights.data, null, 2)}

VAGAS POR LOTE:
${JSON.stringify(vagas.data, null, 2)}
`;

    const prompt = `Você é o assistente analítico pessoal de Elton Oliveira, dono da K-RRO.
Você tem acesso total ao banco de dados da plataforma.
Responda perguntas sobre os dados de forma clara, organizada e em português.
Quando solicitado, formate em tabelas usando | separadores.
Seja direto e preciso. Sem enrolação.

DADOS DO BANCO:
${context}

PERGUNTA DO ELTON: ${message}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0 },
        }),
      }
    );

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Erro ao processar.";

    return NextResponse.json({ message: reply });
  } catch (err) {
    console.error("[ADMIN]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
