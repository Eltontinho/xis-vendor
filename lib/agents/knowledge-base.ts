import fs from "fs";
import path from "path";

function read(filePath: string): string {
  try {
    const fullPath = path.join(process.cwd(), "lib", "knowledge", filePath);
    return fs.readFileSync(fullPath, "utf-8");
  } catch {
    return "";
  }
}

function getCityFile(city: string): string {
  const map: Record<string, string> = {
    "porto alegre": "porto-alegre.md",
    "tramanda": "porto-alegre.md",
    "imbe": "porto-alegre.md",
    "gravata": "porto-alegre.md",
    "canoas": "porto-alegre.md",
    "hamburgo": "porto-alegre.md",
    "osorio": "porto-alegre.md",

    "florian": "florianopolis.md",
    "palhoca": "florianopolis.md",
    "sao jose": "florianopolis.md",
    "joinville": "florianopolis.md",
    "blumenau": "florianopolis.md",

    "curitiba": "curitiba.md",
    "pinhais": "curitiba.md",
    "colombo": "curitiba.md",
  };

  const c = city.toLowerCase();

  for (const key in map) {
    if (c.includes(key)) return map[key];
  }

  return "";
}

/**
 * HARD LIMIT CONTEXT
 */
function cut(text: string, max = 1200): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) : text;
}

export function buildKnowledgeContext(
  driverCity: string | null,
  stage: string
): string {
  const parts: string[] = [];

  // Diferenciais: sempre que não for greeting
  const diferenciais = cut(read("krro/diferenciais.md"), 800);
  if (diferenciais) parts.push(`K-RRO:\n${diferenciais}`);

  // Planos: só quando K-RRO já foi conectado ou clube está sendo mostrado
  if (stage === "krro_shown" || stage === "club_shown" || stage === "pain_revealed") {
    const planos = cut(read("krro/planos.md"), 500);
    if (planos) parts.push(`PLANOS:\n${planos}`);
  }

  // Cidade: quando disponível
  if (driverCity) {
    const file = getCityFile(driverCity);
    if (file) {
      const city = cut(read(`cities/${file}`), 400);
      if (city) parts.push(`CIDADE:\n${city}`);
    }
  }

  return parts.join("\n\n---\n\n");
}