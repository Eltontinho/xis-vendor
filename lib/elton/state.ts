export enum LeadStage {
  NOVO        = "novo",
  QUALIFICADO = "qualificado",
  PRONTO      = "pronto",
  CONVERTIDO  = "convertido",
  PERDIDO     = "perdido",
}

export type Intent = "buy" | "objection" | "neutral";

const BUY_SIGNALS       = ["quero","entrar","comprar","link","fechar","sim","pode mandar","topo","bora","confirmo","fecha"];
const OBJECTION_SIGNALS = ["não","nao","depois","caro","medo","duvida","dúvida","desconfio","golpe","fraude","mentira","furada"];

export function detectIntent(message: string): Intent {
  const msg = message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (BUY_SIGNALS.some(w => msg.includes(w)))       return "buy";
  if (OBJECTION_SIGNALS.some(w => msg.includes(w))) return "objection";
  return "neutral";
}

const TRANSITIONS: Record<string, LeadStage> = {
  [`${LeadStage.NOVO}-buy`]:              LeadStage.QUALIFICADO,
  [`${LeadStage.QUALIFICADO}-buy`]:       LeadStage.PRONTO,
  [`${LeadStage.PRONTO}-buy`]:            LeadStage.CONVERTIDO,
  [`${LeadStage.PRONTO}-objection`]:      LeadStage.QUALIFICADO,
  [`${LeadStage.QUALIFICADO}-objection`]: LeadStage.NOVO,
};

export function getNextStage(current: LeadStage, intent: Intent): LeadStage {
  return TRANSITIONS[`${current}-${intent}`] ?? current;
}
