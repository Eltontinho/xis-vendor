import type { DriverContext } from "./memory";

export type StrategyType =
  | "saudacao"
  | "abrir_gap"
  | "explorar_dor"
  | "ancorar_realidade"
  | "conectar_krro"
  | "responder_direto"
  | "mostrar_clube";

export interface StrategyOutput {
  type: StrategyType;
}

type Msg = { role: "user" | "assistant"; content: string };

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
    t.includes("combustível") ||
    t.includes("combustivel") ||
    t.includes("cansado") ||
    t.includes("rodo muito") ||
    t.includes("não compensa") ||
    t.includes("nao compensa") ||
    t.includes("sobra pouco") ||
    t.includes("taxa alta") ||
    t.includes("descont")
  );
}

export function strategize(
  message: string,
  history: Msg[],
  driverCtx: DriverContext
): StrategyOutput {
  // First message — greeting
  if (history.length === 0 && isShort(message)) {
    return { type: "saudacao" };
  }

  // Unrealistic expectation — anchor to reality
  if (isUnrealExpectation(message)) {
    return { type: "ancorar_realidade" };
  }

  // Club already shown — respond directly and close
  if (driverCtx.stage === "club_shown") {
    return { type: "responder_direto" };
  }

  // K-RRO connected but club not shown — show club
  if (driverCtx.stage === "krro_shown") {
    return { type: "mostrar_clube" };
  }

  // Pain revealed — connect to K-RRO
  if (driverCtx.stage === "pain_revealed" || hasPain(message)) {
    return { type: "conectar_krro" };
  }

  // Direct question — answer it
  if (isDirectQuestion(message)) {
    return { type: "responder_direto" };
  }

  // Still understanding — open gap
  if (driverCtx.stage === "understanding" || isShort(message)) {
    return { type: "abrir_gap" };
  }

  return { type: "explorar_dor" };
}
