import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ESTADO_POR_DDD: Record<string, string> = {
  "11":"SP","12":"SP","13":"SP","14":"SP","15":"SP","16":"SP","17":"SP","18":"SP","19":"SP",
  "21":"RJ","22":"RJ","24":"RJ",
  "27":"ES","28":"ES",
  "31":"MG","32":"MG","33":"MG","34":"MG","35":"MG","37":"MG","38":"MG",
  "41":"PR","42":"PR","43":"PR","44":"PR","45":"PR","46":"PR",
  "47":"SC","48":"SC","49":"SC",
  "51":"RS","53":"RS","54":"RS","55":"RS",
  "61":"DF","62":"GO","64":"GO","63":"TO","65":"MT","66":"MT","67":"MS",
  "68":"AC","69":"RO","71":"BA","73":"BA","74":"BA","75":"BA","77":"BA",
  "79":"SE","81":"PE","87":"PE","82":"AL","83":"PB","84":"RN","85":"CE",
  "88":"CE","86":"PI","89":"PI","91":"PA","93":"PA","94":"PA","92":"AM",
  "97":"AM","95":"RR","96":"AP","98":"MA","99":"MA",
};

function extrairEstado(cidade: string): string {
  // Tenta extrair estado de cidades conhecidas do RS
  const cidadesRS = ["porto alegre","canoas","novo hamburgo","são leopoldo","caxias do sul",
    "pelotas","santa maria","gravataí","viamão","alvorada","sapucaia","cachoeirinha"];
  if (cidadesRS.some(c => cidade.toLowerCase().includes(c))) return "RS";
  return "BR"; // fallback
}

export async function POST(req: NextRequest) {
  try {
    const { session_id, nome, cidade, veiculo_modelo, veiculo_ano, veiculo_cat } = await req.json();

    if (!session_id || !veiculo_modelo || !veiculo_ano) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    // Verifica se já existe pré-cadastro para esta sessão
    const { data: existing } = await supabase
      .from("pre_cadastros")
      .select("numero")
      .eq("session_id", session_id)
      .single();

    if (existing) {
      return NextResponse.json({ numero: existing.numero, novo: false });
    }

    // Extrai estado
    const estado = cidade ? extrairEstado(cidade) : "BR";

    // Gera número sequencial
    const { data: numeroData } = await supabase
      .rpc("gerar_numero_cadastro", { p_estado: estado });

    const numero = numeroData as string;

    // Salva pré-cadastro
    await supabase.from("pre_cadastros").insert({
      numero,
      numero_seq: parseInt(numero.replace(/[A-Z]/g, "")),
      estado,
      nome,
      cidade,
      veiculo_modelo,
      veiculo_ano,
      veiculo_cat,
      session_id,
    });

    return NextResponse.json({ numero, novo: true });
  } catch (err) {
    console.error("[PRECADASTRO]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
