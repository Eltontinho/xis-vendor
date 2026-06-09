// lib/elton/calc.ts
// Conta de padaria — cálculo determinístico de ganhos e payback

export interface PlanTier {
  name: "Prata" | "Ouro" | "Platina";
  price: number; // preço anual em R$
  rate: number; // percentual: 0.90, 0.92, 0.94
  suffix: string; // "PR", "OU", "PL" (para sufixo do número do motorista)
}

export const PLAN_TIERS: PlanTier[] = [
  { name: "Prata", price: 297, rate: 0.90, suffix: "PR" },
  { name: "Ouro", price: 347, rate: 0.92, suffix: "OU" },
  { name: "Platina", price: 397, rate: 0.94, suffix: "PL" },
];

export interface ContaDePadaria {
  dailyEarning: number; // o que o motorista recebe hoje
  bruto: number; // o que o passageiro pagou (total ÷ 0.75)
  taxa: number; // taxa diária que ele perde (bruto - dailyEarning)
  semanal: number; // taxa semanal (taxa × 5)
  mensal: number; // taxa mensal (taxa × 20)
  anual: number; // taxa anual (taxa × 240)
  plans: {
    prata: { diario: number; extraDiario: number; payback: number };
    ouro: { diario: number; extraDiario: number; payback: number };
    platina: { diario: number; extraDiario: number; payback: number };
  };
}

/**
 * Calcula a conta de padaria: quanto o motorista perde em taxa e quanto ganharia em cada plano
 * @param dailyEarning - o que o motorista recebe por dia hoje (em R$)
 */
export function calculateContaDePadaria(dailyEarning: number): ContaDePadaria {
  // Fórmula: bruto = total / 0.75 (porque o motorista recebe ~75% do bruto)
  const bruto = dailyEarning / 0.75;
  const taxa = bruto - dailyEarning;

  const semanal = taxa * 5;
  const mensal = taxa * 20;
  const anual = taxa * 240;

  const plans: ContaDePadaria["plans"] = {
    prata: { diario: 0, extraDiario: 0, payback: 0 },
    ouro: { diario: 0, extraDiario: 0, payback: 0 },
    platina: { diario: 0, extraDiario: 0, payback: 0 },
  };

  for (const plan of PLAN_TIERS) {
    const diario = bruto * plan.rate;
    const extraDiario = diario - dailyEarning;
    const payback = extraDiario > 0 ? Math.ceil(plan.price / extraDiario) : Infinity;

    const key = plan.name.toLowerCase() as keyof typeof plans;
    plans[key] = { diario, extraDiario, payback };
  }

  return {
    dailyEarning: roundMoney(dailyEarning),
    bruto: roundMoney(bruto),
    taxa: roundMoney(taxa),
    semanal: roundMoney(semanal),
    mensal: roundMoney(mensal),
    anual: roundMoney(anual),
    plans,
  };
}

/**
 * Calcula os dias até payback de um plano
 */
export function calculatePayback(planPrice: number, extraDaily: number): number {
  return extraDaily > 0 ? Math.ceil(planPrice / extraDaily) : Infinity;
}

/**
 * Arredonda para 2 casas decimais
 */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Formata um número como moeda brasileira
 */
export function formatMoney(value: number): string {
  if (value === Infinity) return "∞";
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Retorna o plano mais alto disponível (cascata: Platina > Ouro > Prata)
 */
export function getHighestAvailablePlan(available: { prata: boolean; ouro: boolean; platina: boolean }): "prata" | "ouro" | "platina" {
  if (available.platina) return "platina";
  if (available.ouro) return "ouro";
  return "prata";
}
