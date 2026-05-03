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
  persona: string
): string {
  const parts: string[] = [];

  // 1. IDENTIDADE (sempre)
  const identidade = cut(read("elton/identidade.md"), 800);
  if (identidade) parts.push(`IDENTIDADE:\n${identidade}`);

  // 2. DIFERENCIAIS (essencial)
  const diferenciais = cut(read("krro/diferenciais.md"), 800);
  if (diferenciais) parts.push(`K-RRO:\n${diferenciais}`);

  // 3. PLANOS (curto)
  const planos = cut(read("krro/planos.md"), 500);
  if (planos) parts.push(`PLANOS:\n${planos}`);

  // 4. CIDADE (leve, opcional)
  if (driverCity) {
    const file = getCityFile(driverCity);
    if (file) {
      const city = cut(read(`cities/${file}`), 400);
      if (city) parts.push(`CIDADE:\n${city}`);
    }
  }

  // 5. PERSONA (resumo só)
  if (persona && persona !== "unknown") {
    const perfis = cut(read("personas/perfis.md"), 500);
    if (perfis) parts.push(`PERFIL:\n${perfis}`);
  }

  return parts.join("\n\n---\n\n");
}