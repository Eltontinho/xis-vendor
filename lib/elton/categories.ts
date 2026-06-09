// lib/elton/categories.ts
// Categorização determinística de veículos K-RRO

export enum Category {
  GO = "GO",
  PLUS = "PLUS",
  EXEC = "EXEC",
  CARE = "CARE",
}

interface Vehicle {
  model: string;
  year: number;
}

export interface CategoryResult {
  category: Category;
  eligible: boolean;
  reason?: string;
}

// Modelos GO — hatches e sedãs de entrada (sempre GO, 2020+)
const GO_MODELS = ["onix", "polo", "hb20", "argo", "versa", "logan", "cronos"];

// Modelos PLUS — sedãs bem equipados (sempre PLUS, independente de ano)
const PLUS_MODELS = [
  "virtus", "onix ltz", "onix premier", "sentra", "jetta", "cruze lt", "prius",
];

// Modelos EXEC — premium (sempre EXEC)
const EXEC_MODELS = [
  "corolla", "civic", "bmw", "mercedes", "audi", "volvo", "byd seal", "byd han",
];

// Ex-SUVs: 2020-2021 → PLUS; 2022+ → EXEC
const EXSUV_MODELS = ["creta", "t-cross", "tracker", "kicks", "hr-v", "nivus", "pulse", "renegade"];

// Ineligíveis
const INELIGIBLE_KEYWORDS = [
  "saveiro", "montana", "s10", "ranger", "amarok", "hilux", "baú", "pickup",
];

export function isEligible(vehicle: Vehicle): { eligible: boolean; reason?: string } {
  if (vehicle.year < 2020) {
    return { eligible: false, reason: "Veículo anterior a 2020. Mínimo: 2020." };
  }

  const modelLower = vehicle.model.toLowerCase();
  for (const keyword of INELIGIBLE_KEYWORDS) {
    if (modelLower.includes(keyword)) {
      return { eligible: false, reason: `${vehicle.model} não é elegível (pickup/comercial).` };
    }
  }

  return { eligible: true };
}

export function getCategoryByVehicle(model: string, year: number): CategoryResult {
  const eligibility = isEligible({ model, year });
  if (!eligibility.eligible) {
    return { category: Category.GO, eligible: false, reason: eligibility.reason };
  }

  const modelLower = model.toLowerCase().trim();

  // Tenta match em cada grupo
  if (GO_MODELS.some(m => modelLower.includes(m))) {
    return { category: Category.GO, eligible: true };
  }

  if (PLUS_MODELS.some(m => modelLower.includes(m))) {
    return { category: Category.PLUS, eligible: true };
  }

  if (EXEC_MODELS.some(m => modelLower.includes(m))) {
    return { category: Category.EXEC, eligible: true };
  }

  // Ex-SUVs com regra de ano
  if (EXSUV_MODELS.some(m => modelLower.includes(m))) {
    const category = year >= 2022 ? Category.EXEC : Category.PLUS;
    return { category, eligible: true };
  }

  // Fallback: GO (vai pedir confirmação ao Elton)
  return { category: Category.GO, eligible: true };
}

export function getCategories(): Category[] {
  return [Category.GO, Category.PLUS, Category.EXEC, Category.CARE];
}

export function isValidCategory(cat: string): cat is Category {
  return Object.values(Category).includes(cat as Category);
}
