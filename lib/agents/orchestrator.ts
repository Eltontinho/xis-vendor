import { classify } from "./classifier";
import { strategize } from "./strategist";
import { buildKnowledgeContext } from "./knowledge-base";
import { generateVoice } from "./voice";
import { guard } from "./guardian";
import { extractDriverContext, formatDriverContext } from "./memory";

type Msg = { role: "user" | "assistant"; content: string };

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
    // 1. RISCO
    const classification = classify(message, history);
    if (classification.risk === "high") {
      return "Não vou seguir por esse caminho.";
    }

    // 2. MEMÓRIA — contexto estruturado do histórico
    const driverCtx = extractDriverContext(history);
    const resolvedCity = driverCtx.city || driverCity || null;

    // 3. ESTRATÉGIA — stage-aware
    const strategy = strategize(message, history, driverCtx);

    // 4. CONTEXTO DO SISTEMA
    const systemParts: string[] = [];

    const driverContextStr = formatDriverContext(driverCtx);
    if (driverContextStr) systemParts.push(driverContextStr);

    // Knowledge base só quando relevante (não no greeting)
    if (driverCtx.stage !== "greeting") {
      const knowledge = buildKnowledgeContext(resolvedCity, driverCtx.stage);
      if (knowledge) systemParts.push(knowledge);
    }

    // 5. VOZ
    const draft = await generateVoice(systemParts, history, message, strategy.type);

    // 6. GUARDIAN
    return await guard(draft);
  } catch (err) {
    console.error("[orchestrator]", err);
    return "Deu erro aqui. Me chama de novo.";
  }
}
