export type StrategyType =
  | "abrir_gap"
  | "explorar_dor"
  | "ancorar_realidade"
  | "conectar_krro"
  | "responder_direto"
  | "mostrar_clube"
  | "saudacao";

export interface StrategyOutput {
  type: StrategyType;
}

function isShort(text: string) {
  return text.trim().split(" ").length <= 2;
}

function isUnrealExpectation(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("200") ||
    t.includes("150") ||
    t.includes("100 por hora") ||
    t.includes("100/h") ||
    t.includes("garante")
  );
}

function isDirectQuestion(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("?") ||
    t.includes("como") ||
    t.includes("quanto") ||
    t.includes("km") ||
    t.includes("hora")
  );
}

function hasPain(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("gasolina") ||
    t.includes("lucro") ||
    t.includes("ganho") ||
    t.includes("cansado") ||
    t.includes("rodo muito") ||
    t.includes("não compensa") ||
    t.includes("nao compensa") ||
    t.includes("sobra pouco")
  );
}

function mentionedKRRO(history: string[]) {
  return history.some((m) => m.toLowerCase().includes("k-rro"));
}

export function strategize(
  message: string,
  history: string[]
): StrategyOutput {

  if (history.length === 0 && isShort(message)) {
    return { type: "saudacao" };
  }

  if (isUnrealExpectation(message)) {
    return { type: "ancorar_realidade" };
  }

  if (isDirectQuestion(message)) {
    return { type: "responder_direto" };
  }

  if (mentionedKRRO(history)) {
    return { type: "mostrar_clube" };
  }

  if (hasPain(message)) {
    return { type: "conectar_krro" };
  }

  if (isShort(message)) {
    return { type: "abrir_gap" };
  }

  return { type: "explorar_dor" };
}