export const ELTON_FALLBACK =
  "Entendido. Me diz: qual é o modelo e o ano do seu carro?";

const ALLOWED_VALUES = ["15,00","15.00","8,00","8.00","100.000","100000","297","397","197","80","90","92","94","20"];

export function validateEltonOutput(content: string | null | undefined): boolean {
  if (!content || content.trim().length < 10) return false;

  if (/r\$\s*0[,.]25/i.test(content))                      return false;
  if (/você (vai|pode|irá) ganhar/i.test(content))         return false;
  if (/\b(sure!|i understand|of course|hello)\b/i.test(content)) return false;
  if ((content.match(/\?/g) ?? []).length >= 3)            return false;
  if (/platina[\s\S]*ouro[\s\S]*prata/i.test(content))     return false;

  const monetaryMatches = content.match(/r\$\s*[\d.,]+/gi) ?? [];
  for (const match of monetaryMatches) {
    const digits = match.replace(/[^0-9.,]/g, "");
    if (!ALLOWED_VALUES.some(ok => digits.includes(ok))) return false;
  }

  return true;
}
