// CONTROLE MANUAL DE VAGAS — Elton edita estes 3 números conforme confirma pagamentos.
// Platina vendido: +1 em PLATINA_VENDIDAS. Ouro vendido: +1 em OURO_VENDIDAS. Prata vendido: +1 em PRATA_VENDIDAS.
// Cancelamento/reembolso: -1 no respectivo (reabre vaga automaticamente).

export const PLATINA_VENDIDAS = 0;  // de 100
export const OURO_VENDIDAS = 0;     // de 200
export const PRATA_VENDIDAS = 0;    // de 300

export const PLATINA_VAGAS = 100 - PLATINA_VENDIDAS;
export const OURO_VAGAS = 200 - OURO_VENDIDAS;
export const PRATA_VAGAS = 300 - PRATA_VENDIDAS;

export type PlanoCascata = "platina" | "ouro" | "prata" | "esgotado";

export function getPlanoAtual(): PlanoCascata {
  if (PLATINA_VAGAS > 0) return "platina";
  if (OURO_VAGAS > 0) return "ouro";
  if (PRATA_VAGAS > 0) return "prata";
  return "esgotado";
}

export const LINKS_PAGAMENTO: Record<"platina" | "ouro" | "prata", string> = {
  platina: "https://mpago.li/2PtKd68",
  ouro: "https://mpago.li/1UezYYy",
  prata: "https://mpago.li/1niGpxN",
};

export const LINKS_GRUPO: Record<"GO" | "PLUS" | "EXEC", string> = {
  GO: "https://chat.whatsapp.com/CrzI3apIBnu3hFZvisBK9f?s=cl&p=a&mlu=1",
  PLUS: "https://chat.whatsapp.com/KFSmxHiIGtWFORACaoQCEP?s=cl&p=a&mlu=1",
  EXEC: "https://chat.whatsapp.com/DIg3YPd8OLf8qLcmk097nd?s=cl&p=a&mlu=1",
};
