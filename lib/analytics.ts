// Augmentação global para os SDKs de analytics injetados pelo <Analytics />
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

export function trackChatStarted() {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "StartCheckout");
  window.gtag?.("event", "begin_checkout");
  window.clarity?.("event", "chat_started");
}

export function trackPurchase(value: number) {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "Purchase", { value, currency: "BRL" });
  window.gtag?.("event", "purchase", { value, currency: "BRL" });
  window.clarity?.("event", "purchase_completed");
}

export function trackViewClubeKRRO() {
  if (typeof window === "undefined") return;
  window.fbq?.("track", "ViewContent", { content_name: "Clube K-RRO" });
  window.gtag?.("event", "view_item");
}
