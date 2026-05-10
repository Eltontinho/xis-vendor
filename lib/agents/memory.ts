export interface DriverContext {
  name: string | null;
  city: string | null;
  car: string | null;
  dailyRides: number | null;
  avgTicket: number | null;
  pains: string[];
  stage: "greeting" | "understanding" | "pain_revealed" | "krro_shown" | "club_shown";
}

export function extractDriverContext(
  history: { role: "user" | "assistant"; content: string }[]
): DriverContext {
  const ctx: DriverContext = {
    name: null, city: null, car: null,
    dailyRides: null, avgTicket: null,
    pains: [], stage: "greeting",
  };

  if (history.length === 0) return ctx;

  const allUser = history.filter(h => h.role === "user").map(h => h.content).join(" ");
  const allAssistant = history.filter(h => h.role === "assistant").map(h => h.content).join(" ").toLowerCase();
  const allText = history.map(h => h.content).join(" ");

  // Stage detection (most advanced first)
  if (allAssistant.includes("{{clube_krro}}") || allAssistant.includes("clube k-rro")) {
    ctx.stage = "club_shown";
  } else if (allAssistant.includes("k-rro")) {
    ctx.stage = "krro_shown";
  } else if (/sobra|gasolina|taxa|cansad|não compensa|nao compensa|perdendo/i.test(allUser)) {
    ctx.stage = "pain_revealed";
  } else if (history.length >= 4) {
    ctx.stage = "understanding";
  }

  // Name: detect user reply after Elton asks for name
  for (let i = 0; i < history.length - 1; i++) {
    const cur = history[i];
    const nxt = history[i + 1];
    if (
      cur.role === "assistant" &&
      /nome|chama/i.test(cur.content) &&
      nxt.role === "user"
    ) {
      const candidate = nxt.content.trim();
      if (candidate.split(" ").length <= 3 && !/\d/.test(candidate) && candidate.length < 25) {
        ctx.name = candidate;
      }
    }
  }

  // Car model
  const carMatch = allText.match(
    /\b(onix|polo|hb20|argo|cronos|kicks|creta|virtus|nivus|corolla|civic|hilux|tucson|compass|renegade|sandero|logan|voyage|gol|ecosport|duster|t-cross|pulse)\b/i
  );
  if (carMatch) ctx.car = carMatch[1];

  // City
  const cityMatch = allText.match(
    /\b(porto alegre|florianópolis|florianopolis|curitiba|são paulo|sao paulo|rio de janeiro|belo horizonte|salvador|fortaleza|recife)\b/i
  );
  if (cityMatch) ctx.city = cityMatch[1];

  // Daily rides
  const ridesMatch = allText.match(/(\d+)\s*corridas?/i);
  if (ridesMatch) ctx.dailyRides = parseInt(ridesMatch[1]);

  // Average ticket
  const ticketMatch = allText.match(/r\$\s*(\d+)/i);
  if (ticketMatch) ctx.avgTicket = parseInt(ticketMatch[1]);

  // Pains
  if (/sobra pouco|sobra nada|não sobra|nao sobra/i.test(allUser)) ctx.pains.push("sobra pouco no fim do dia");
  if (/gasolina|combustível|combustivel/i.test(allUser)) ctx.pains.push("gasto alto com combustível");
  if (/taxa|plataforma cobra|descont/i.test(allUser)) ctx.pains.push("taxa alta da plataforma");
  if (/cansad|muito tempo|horas rodando/i.test(allUser)) ctx.pains.push("cansaço de rodar muito");
  if (/imprevisível|imprevisivel|não sei quanto|nao sei quanto/i.test(allUser)) ctx.pains.push("ganho imprevisível");

  return ctx;
}

export function formatDriverContext(ctx: DriverContext): string {
  const lines: string[] = [];
  if (ctx.name) lines.push(`Nome: ${ctx.name}`);
  if (ctx.car) lines.push(`Carro: ${ctx.car}`);
  if (ctx.city) lines.push(`Cidade: ${ctx.city}`);
  if (ctx.dailyRides !== null) lines.push(`Corridas/dia: ${ctx.dailyRides}`);
  if (ctx.avgTicket !== null) lines.push(`Ticket médio: R$${ctx.avgTicket}`);
  if (ctx.pains.length > 0) lines.push(`Dores reveladas: ${ctx.pains.join(" | ")}`);
  if (lines.length === 0) return "";
  return `MOTORISTA (use isso — não invente nada além):\n${lines.join("\n")}`;
}
