export interface GeoLocation {
  city: string;
  region: string;
  country: string;
}

export async function getLocationFromIP(): Promise<GeoLocation | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      headers: { Accept: "application/json" },
      // Timeout manual via AbortController — ipapi.co pode ser lento
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Rejeita respostas de erro da API (plano gratuito retorna campo "error")
    if (data.error) return null;
    return {
      city: (data.city as string) ?? "",
      region: (data.region as string) ?? "",
      country: (data.country_name as string) ?? "",
    };
  } catch {
    return null;
  }
}
