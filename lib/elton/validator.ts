export const ELTON_FALLBACK =
  "Entendido. Me diz uma coisa: qual é o modelo e o ano do teu carro?";

export function validateEltonOutput(content: string | null | undefined): boolean {
  if (!content || content.trim().length < 10) return false;

  if (/r\$\s*0[,.]25/i.test(content)) return false;

  if (/você (vai|pode) ganhar/i.test(content)) return false;

  if (/\b(sure!|i understand|of course)\b/i.test(content)) return false;

  const questionCount = (content.match(/\?/g) ?? []).length;
  if (questionCount >= 3) return false;

  if (/platina[\s\S]*ouro[\s\S]*prata/i.test(content)) return false;

  return true;
}
