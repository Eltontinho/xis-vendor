export type StrategyType =
  | "abrir_gap"
  | "conectar_krro"
  | "responder_direto"
  | "mostrar_clube"
  | "fechar";

export interface StrategyOutput {
  type: StrategyType;
}

function isShort(text: string) {
  return text.trim().split(" ").length <= 2;
}

function isDirectQuestion(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("?") ||
    t.includes("quanto") ||
    t.includes("como") ||
    t.includes("funciona") ||
    t.includes("garante") ||
    t.includes("km") ||
    t.includes("hora")
  );
}

function mentionedKRRO(history: string[]) {
  return history.some((m) => m.toLowerCase().includes("k-rro"));
}

export function strategize(
  message: string,
  history: string[]
): StrategyOutput {
  if (isDirectQuestion(message)) {
    return { type: "responder_direto" };
  }

  if (mentionedKRRO(history)) {
    return { type: "mostrar_clube" };
  }

  if (history.length <= 2) {
    return { type: "abrir_gap" };
  }

  if (isShort(message)) {
    return { type: "conectar_krro" };
  }

  return { type: "conectar_krro" };
}

export function buildStrategyInstruction(type: StrategyType): string {
  switch (type) {
    case "abrir_gap":
      return `Crie curiosidade em 1 frase curta. Não explique ainda.`;

    case "conectar_krro":
      return `Pare de perguntar. Conecte direto com a K-RRO em linguagem simples.`;

    case "responder_direto":
      return `Responda exatamente o que foi perguntado. Sem rodeio.`;

    case "mostrar_clube":
      return `Envie exatamente: Deixa eu te mostrar o Clube K-RRO. {{CLUBE_KRRO}}`;

    case "fechar":
      return `Confirme decisão e peça dados.`;
  }
}