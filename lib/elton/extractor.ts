const VALID_DDDS = new Set([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24",
  "27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46",
  "47","48","49",
  "51","53","54","55",
  "61",
  "62","64",
  "63",
  "65","66",
  "67",
  "68",
  "69",
  "71","73","74","75","77",
  "79",
  "81","87",
  "82",
  "83",
  "84",
  "85","88",
  "86","89",
  "91","93","94",
  "92","97",
  "95",
  "96",
  "98","99",
]);

export function extractDDD(phone: string): string | null {
  const ddd = phone.slice(0, 2);
  return VALID_DDDS.has(ddd) ? ddd : null;
}

const FEAR_SIGNALS: Record<string, string> = {
  "golpe":       "golpe_fraude",
  "fraude":      "golpe_fraude",
  "mentira":     "golpe_fraude",
  "enganar":     "golpe_fraude",
  "perder":      "perda_dinheiro",
  "dinheiro":    "perda_dinheiro",
  "caro":        "custo_alto",
  "não vale":    "custo_alto",
  "medo":        "medo_generico",
  "não sei":     "incerteza",
  "desconfiado": "incerteza",
};

const DESIRE_SIGNALS: Record<string, string> = {
  "independência":   "independencia_financeira",
  "independente":    "independencia_financeira",
  "sair do aluguel": "sair_aluguel",
  "casa própria":    "sair_aluguel",
  "família":         "seguranca_familia",
  "filho":           "seguranca_familia",
  "estabilidade":    "estabilidade",
  "renda extra":     "renda_extra",
  "ganhar mais":     "renda_extra",
  "aposentar":       "aposentadoria",
};

export interface ExtractedProfile {
  vehicle_model?: string;
  vehicle_year?:  number;
  rides_per_day?: number;
  main_pain?:     string;
  plan_chosen?:   "prata" | "ouro" | "platina";
  biggest_fear?:  string;
  main_desire?:   string;
}

export function extractProfileUpdates(conversationText: string): ExtractedProfile {
  const text   = conversationText.toLowerCase();
  const result: ExtractedProfile = {};

  const ridesMatch = text.match(/(?:faço|umas?|[^\d]|^)(\d{1,2})\s*corridas?/);
  if (ridesMatch) result.rides_per_day = parseInt(ridesMatch[1], 10);

  const yearMatch = text.match(/\b(20[12][0-9])\b/);
  if (yearMatch) result.vehicle_year = parseInt(yearMatch[1], 10);

  if (text.includes("platina"))                                    result.plan_chosen = "platina";
  else if (text.includes("ouro"))                                  result.plan_chosen = "ouro";
  else if (text.includes("prata"))                                 result.plan_chosen = "prata";

  if (text.includes("gasolina") || text.includes("combustível"))  result.main_pain = "combustivel";
  else if (text.includes("seguro"))                               result.main_pain = "seguro";
  else if (text.includes("taxa") || text.includes("uber"))        result.main_pain = "taxa_plataforma";
  else if (text.includes("manutenção") || text.includes("revisão")) result.main_pain = "manutencao";

  for (const [signal, value] of Object.entries(FEAR_SIGNALS)) {
    if (text.includes(signal)) { result.biggest_fear = value; break; }
  }

  for (const [signal, value] of Object.entries(DESIRE_SIGNALS)) {
    if (text.includes(signal)) { result.main_desire = value; break; }
  }

  return result;
}
