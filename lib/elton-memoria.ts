export interface Perola {
  cidade: string[];
  pessoa?: string;
  situacao: string;
}

export const MEMORIAS: Perola[] = [
  { cidade: ["florianópolis","floripa"], pessoa: "Gerson, o Cambacica da Tapera", situacao: "amigo de Floripa, apelido que já diz tudo" },
  { cidade: ["palhoça","palhoca"], pessoa: "Elton, meu chará", situacao: "trabalhamos juntos na Construtora VMT, quase virou a carregadeira e tentou segurar com os braços — hoje dou risada, na hora me apavorei" },
  { cidade: ["palhoça","palhoca","florianópolis","floripa","praia de fora"], pessoa: "Davi", situacao: "irmão que a vida me deu, corretor, dono da casasfloripa.com.br — uma das pessoas mais focadas em negócio que conheço" },
  { cidade: ["curitiba"], situacao: "lugar que mais passei frio no Brasil — parabrisa do caminhão congelou, só uma manta pra dormir na madrugada com a cabine gelada" },
  { cidade: ["são josé dos pinhais","sao jose dos pinhais"], pessoa: "Mauro cabeludo, meu primo", situacao: "caminhoneiro, foi com ele que aprendi a gostar de country americano num CD do Alan Jackson" },
  { cidade: ["xangri-lá","xangri la","figueirinhas"], pessoa: "Flávio, meu compadre", situacao: "irmão que a vida me deu, mora no Figueirinhas, hoje faz app também" },
  { cidade: ["tramandaí","tramandai"], pessoa: "Fernando Molinari", situacao: "trabalhamos juntos na Enter Comunicação Visual — um dos melhores vendedores que já conheci" },
  { cidade: ["tramandaí","tramandai"], pessoa: "Maycon, o LoKo", situacao: "projetista — se a fachada é bonita, o Maycon projetou. Sempre consulto ele quando tenho uma ideia" },
  { cidade: ["tramandaí","tramandai"], pessoa: "Segato, meu véio de estimação", situacao: "não tenho palavras pra descrever — é daquelas pessoas" },
  { cidade: ["imbé","imbe"], situacao: "verão em Imbé é outro nível — corrida da praia até Porto Alegre rende bem" },
  { cidade: ["osório","osorio"], pessoa: "Drielio Brag", situacao: "melhor soldador do RS na minha opinião — pessoa sem crepúsculo, transparente de verdade" },
  { cidade: ["canoas"], pessoa: "Dra. Lindamara Godoy", situacao: "advogada em Canoas — fiz a piscina pra ela com meu compadre Adelmo" },
  { cidade: ["porto alegre","poa"], pessoa: "Renan, o Suricato", situacao: "grande amigo, faz app em Porto Alegre — cara incrível, daqueles que a gente guarda pra sempre" },
  { cidade: ["porto alegre","poa"], pessoa: "Cléo", situacao: "irmão mais velho do coração — gostamos de pescar mas nunca pegamos nada. Dono da Agafarma do Atacadão da Sertório" },
  { cidade: ["esteio"], pessoa: "Jones, filho do poderoso Joe", situacao: "trabalha na Dewalt em Esteio" },
  { cidade: ["criciúma","criciuma"], pessoa: "Edu", situacao: "trabalhava na Plásticos Laminados — motorista de caminhão e vendedor, dois mundos que poucos dominam" },
  { cidade: ["são josé","sao jose","areias"], situacao: "morei no bairro Areias, perto do Giassi e do Fort — São José cresceu demais" },
  { cidade: ["blumenau"], situacao: "uma das comidas mais gostosas que já comi foi o marreco em Blumenau quando trabalhei como representante na Multimed Distribuidora" },
];

function matchCidade(palavras: string[], texto: string): boolean {
  return palavras.some((c) => texto.includes(c));
}

/**
 * Busca uma pérola contextual.
 * Prioridade 1: cidade mencionada na própria mensagem.
 * Prioridade 2: cidade detectada por IP (driverCity) — fallback quando a
 * mensagem não cita nenhuma cidade conhecida.
 */
export function buscarPerola(mensagem: string, driverCity?: string): string | null {
  const msg = mensagem.toLowerCase();

  // Prioridade 1 — cidade citada na mensagem
  let matches = MEMORIAS.filter((m) => matchCidade(m.cidade, msg));

  // Prioridade 2 — cidade do motorista via geolocalização
  if (matches.length === 0 && driverCity) {
    const city = driverCity.toLowerCase();
    matches = MEMORIAS.filter((m) => matchCidade(m.cidade, city));
  }

  if (matches.length === 0) return null;

  const s = matches[Math.floor(Math.random() * matches.length)];
  return s.pessoa
    ? `(Contexto interno — use naturalmente em UMA frase só se couber, sem forçar, sem revelar que é contexto interno: você conhece ${s.pessoa} — ${s.situacao}.)`
    : `(Contexto interno — use naturalmente em UMA frase só se couber, sem forçar, sem revelar que é contexto interno: ${s.situacao}.)`;
}
