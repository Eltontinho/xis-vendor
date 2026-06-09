// lib/elton/cities.ts
// Conhecimento local: bairros, landmarks, contexto por cidade

export interface CityData {
  name: string;
  state: string;
  aliases: string[]; // variações do nome (poa, pa, porto)
  neighborhoods: string[]; // bairros premium/target
  landmarks: string[]; // pontos de referência
  context: {
    certidaoLink?: string; // link para certidão de antecedentes
    notes?: string;
  };
}

export const CITIES: Record<string, CityData> = {
  "porto-alegre": {
    name: "Porto Alegre",
    state: "RS",
    aliases: ["poa", "pa", "porto", "alegre"],
    neighborhoods: [
      "Moinhos de Vento",
      "Petrópolis",
      "Bela Vista",
      "Centro",
      "Higienópolis",
      "Cavalhada",
      "Mont Serrat",
      "Boa Vista",
      "Praia de Belas",
    ],
    landmarks: [
      "Gasômetro",
      "Monumento ao Laçador",
      "Aeroporto Salgado Filho",
      "Iguatemi",
      "Praia de Belas",
      "Ponte do Guaíba",
    ],
    context: {
      certidaoLink: "https://www.pc.rs.gov.br/emitir-certidao-de-antecedentes-policiais",
      notes: "Primeira cidade K-RRO, lançamento 15/06/2026. Foco em bairros premium.",
    },
  },
};

/**
 * Retorna dados da cidade por nome ou alias
 */
export function getCityByName(name: string): CityData | null {
  const normalized = name.toLowerCase().trim();

  // Tenta match direto
  if (CITIES[normalized]) {
    return CITIES[normalized];
  }

  // Tenta match por alias
  for (const city of Object.values(CITIES)) {
    if (city.aliases.includes(normalized)) {
      return city;
    }
  }

  return null;
}

/**
 * Retorna string formatada: "Cidade, UF"
 */
export function getCityContext(cityName: string): string {
  const city = getCityByName(cityName);
  if (!city) return cityName; // fallback ao nome original se não encontrar

  return `${city.name}, ${city.state}`;
}

/**
 * Retorna link de certidão da cidade, se disponível
 */
export function getCertidaoLink(cityName: string): string | null {
  const city = getCityByName(cityName);
  return city?.context.certidaoLink ?? null;
}

/**
 * Lista todos os bairros de uma cidade (pra validação)
 */
export function getNeighborhoods(cityName: string): string[] {
  const city = getCityByName(cityName);
  return city?.neighborhoods ?? [];
}

/**
 * Valida se uma cidade está suportada
 */
export function isSupportedCity(cityName: string): boolean {
  return getCityByName(cityName) !== null;
}
