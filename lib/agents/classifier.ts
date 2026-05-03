export interface Classification {
  temperature: "cold" | "warm" | "hot";
  risk: "none" | "high";
  persona: "direct" | "confused" | "apathetic" | "skeptic" | "problematic";
}

const DEFAULT: Classification = {
  temperature: "cold",
  risk: "none",
  persona: "direct",
};

function normalize(text: string) {
  return text.toLowerCase();
}

function isShort(text: string) {
  return text.trim().split(" ").length <= 2;
}

function isApathetic(text: string) {
  const t = normalize(text);
  return (
    t === "sei la" ||
    t === "sei lá" ||
    t === "tanto faz" ||
    t === "normal" ||
    isShort(t)
  );
}

function isConfused(text: string) {
  const t = normalize(text);
  return (
    t.includes("como funciona") ||
    t.includes("não entendi") ||
    t.includes("nao entendi") ||
    t.includes("explica")
  );
}

function isSkeptic(text: string) {
  const t = normalize(text);
  return (
    t.includes("garante") ||
    t.includes("verdade") ||
    t.includes("isso funciona") ||
    t.includes("duvido")
  );
}

function isProblematic(text: string) {
  const t = normalize(text);
  return (
    t.includes("idiota") ||
    t.includes("lixo") ||
    t.includes("merda") ||
    t.includes("preto") ||
    t.includes("viado")
  );
}

function isHot(text: string) {
  const t = normalize(text);
  return (
    t.includes("quero") ||
    t.includes("como pago") ||
    t.includes("manda link") ||
    t.includes("fechar")
  );
}

export function classify(
  message: string,
  history: { role: "user" | "assistant"; content: string }[]
): Classification {
  const msg = normalize(message);

  // risco
  if (isProblematic(msg)) {
    return { temperature: "cold", risk: "high", persona: "problematic" };
  }

  // temperatura
  if (isHot(msg)) {
    return { temperature: "hot", risk: "none", persona: "direct" };
  }

  // persona
  if (isApathetic(msg)) {
    return { temperature: "cold", risk: "none", persona: "apathetic" };
  }

  if (isConfused(msg)) {
    return { temperature: "cold", risk: "none", persona: "confused" };
  }

  if (isSkeptic(msg)) {
    return { temperature: "warm", risk: "none", persona: "skeptic" };
  }

  return DEFAULT;
}