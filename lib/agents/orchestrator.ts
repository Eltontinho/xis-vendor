import { classify } from "./classifier";
import { strategize } from "./strategist";
import { buildKnowledgeContext } from "./knowledge-base";
import { generateVoice } from "./voice";
import { guard } from "./guardian";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

interface OrchestratorInput {
  message: string;
  history: Msg[];
  driverCity?: string | null;
  conversationId?: string | null;
  reservedNumber?: number;
  perola?: string | null;
}

export async function orchestrate({
  message,
  history,
  driverCity,
}: OrchestratorInput): Promise<string> {
  try {
    // 1. CLASSIFICAÇÃO
    const classification = await classify(message, history);

    // BLOQUEIO DE RISCO
    if (classification.risk === "high") {
      return "Não vou seguir por esse caminho.";
    }

    // 2. ESTRATÉGIA (DECISÃO DO QUE FAZER)
    const strategy = strategize(
      message,
      history.map((h) => h.content)
    );

    // 3. CONTEXTO (CONHECIMENTO)
    const knowledge = buildKnowledgeContext(
      driverCity || null,
      classification.persona
    );

    const systemParts: string[] = [];

    // injeta contexto
    if (knowledge) systemParts.push(knowledge);

    // injeta leitura da pessoa (leve, sem poluir)
    systemParts.push(`Perfil detectado: ${classification.persona}.`);

    // 4. GERA RESPOSTA (COM ESTRATÉGIA)
    const draft = await generateVoice(
      systemParts,
      history,
      message,
      strategy.type
    );

    // 5. GUARDA (CORRIGE EXCESSO / ROBÔ)
    const final = await guard(draft);

    return final;
  } catch (err) {
    console.error("[orchestrator]", err);
    return "Deu erro aqui. Me chama de novo.";
  }
}