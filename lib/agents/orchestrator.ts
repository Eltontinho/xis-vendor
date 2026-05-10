import { classify } from "./classifier";
import { strategize } from "./strategist";
import { buildKnowledgeContext } from "./knowledge-base";
import { generateVoice } from "./voice";
import { debate } from "./debater";
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
    const [classification, strategy] = await Promise.all([
      classify(message, history),
      strategize(message, history.map((h) => h.content)),
    ]);

    if (classification.risk === "high") {
      return "Não vou seguir por esse caminho.";
    }

    const knowledge = buildKnowledgeContext(driverCity || null, classification.persona);

    const systemParts: string[] = [];
    if (knowledge) systemParts.push(knowledge);
    systemParts.push(`Perfil detectado: ${classification.persona}. Temperatura: ${classification.temperature}.`);

    const draft = await generateVoice(systemParts, history, message, strategy.type);

    const debated = await debate({ draft, userMessage: message });

    const final = await guard(debated);

    return final;
  } catch (err) {
    console.error("[orchestrator]", err);
    return "Deu erro aqui. Me chama de novo.";
  }
}
