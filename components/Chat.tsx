"use client";

import { useEffect, useRef, useState } from "react";
import FounderCards from "./FounderCards";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Lot = {
  name: "PLATINA" | "OURO" | "PRATA";
  price: number;
  installment: string;
  percent: number;
  total: number;
  reserved: number;
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function Chat({ driverCity }: { driverCity?: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: "init", role: "assistant", content: "Oi! Sou o Elton, consultor da K-RRO. Qual é o seu nome?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const streamBufRef = useRef("");
  const rafPendingRef = useRef(false);
  const streamMsgIdRef = useRef("");
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    setTimeout(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }

  function scheduleRenderUpdate() {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      const content = streamBufRef.current;
      const id = streamMsgIdRef.current;
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)));
    });
  }

  async function sendMessage(text?: string) {
    const msgText = (text ?? input).trim();
    if (!msgText || loading) return;
    if (!text) setInput("");

    const userMsgId = generateId();
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: msgText }]);
    setLoading(true);

    const axisId = generateId();
    streamBufRef.current = "";
    streamMsgIdRef.current = axisId;
    let gotFirst = false;
    let localConvId = conversationId;

    try {
      const res = await fetch("/api/axis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msgText,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          conversationId,
          driverCity,
        }),
      });

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data.startsWith("[META]")) {
            try {
              const meta = JSON.parse(data.slice(6)) as { conversationId?: string };
              if (meta.conversationId) { setConversationId(meta.conversationId); localConvId = meta.conversationId; }
            } catch {}
            continue;
          }

          let chunk: string;
          try { chunk = JSON.parse(data) as string; } catch { chunk = data; }
          if (!chunk) continue;

          streamBufRef.current += chunk;

          if (!gotFirst) {
            gotFirst = true;
            setLoading(false);
            setMessages((prev) => [...prev, { id: axisId, role: "assistant", content: streamBufRef.current }]);
          } else {
            scheduleRenderUpdate();
          }
        }
      }

      rafPendingRef.current = false;
      const fullText = streamBufRef.current;
      let finalText = fullText;

      if (fullText.includes("{{CLUBE_KRRO}}")) {
        setShowCards(true);
        finalText = fullText.replace("{{CLUBE_KRRO}}", "").trim();
      }

      const loteMatch = finalText.match(/\[[^\]]*lote[^\]]*([1-3])[^\]]*\]/i);
      if (loteMatch && localConvId) {
        const lot = `lote${loteMatch[1]}`;
        try {
          const reserveRes = await fetch("/api/reserve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lot, conversation_id: localConvId, driver_city: driverCity || "" }),
          });
          const reserveData = await reserveRes.json();
          if (reserveData.success && reserveData.checkout_url) {
            finalText = finalText.replace(loteMatch[0], reserveData.checkout_url);
          } else if (reserveData.available === false) {
            const nextN = Number(loteMatch[1]) < 3 ? Number(loteMatch[1]) + 1 : null;
            finalText = finalText.replace(loteMatch[0], nextN ? `Lote ${loteMatch[1]} esgotado. Posso ver o Lote ${nextN}?` : "Todas as vagas estão esgotadas.");
          }
        } catch {}
      }

      setMessages((prev) => prev.map((m) => (m.id === axisId ? { ...m, content: finalText } : m)));
    } catch {
      setMessages((prev) => [...prev, { id: generateId(), role: "assistant", content: "Deu erro aqui. Me chama de novo." }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleSelectLot(lot: Lot) { sendMessage(`Quero o ${lot.name}`); }

  useEffect(() => { scrollToBottom(); }, [messages, showCards]);

  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER ?? "";
  const waHref = waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=Oi+Elton%2C+quero+saber+mais+sobre+a+K-RRO` : "#";

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", background: "#000000" }}>
      <style>{`
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes neon-glow { 0%, 100% { box-shadow: 0 0 8px #0066ff; } 50% { box-shadow: 0 0 16px #00aaff; } }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: #0066ff; border-radius: 4px; }
        .chat-input:focus { box-shadow: 0 0 8px #0066ff; outline: none; }
        .chat-input::placeholder { color: rgba(0,102,255,0.5); }
        .chat-input { caret-color: #0066ff; }
        .send-btn:hover:not(:disabled) { background: #00aaff !important; }
        .typing-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #0066ff; margin: 0 2px; animation: pulse-dot 1.2s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* WhatsApp flutuante */}
      {waNumber && (
        <a href={waHref} target="_blank" rel="noopener noreferrer"
          style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, width: 52, height: 52, borderRadius: "50%", backgroundColor: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(37,211,102,0.4)", textDecoration: "none" }}>
          <svg viewBox="0 0 24 24" fill="white" width={28} height={28}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}

      {/* Container principal */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#000000", width: "100%", maxWidth: 480, height: "100vh", boxShadow: "0 0 40px rgba(0,102,255,0.25), inset 0 0 0 1px rgba(0,102,255,0.15)" }}>

        {/* Header */}
        <div style={{ background: "#000000", borderBottom: "1px solid #0066ff", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, boxShadow: "0 0 12px rgba(0,102,255,0.3)" }}>
          <img src="/logo-krro.png" alt="K-RRO" style={{ height: 28, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Elton</div>
            <div style={{ color: "#00aaff", fontSize: 11 }}>Consultor K-RRO</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00aaff", animation: "pulse-dot 2s infinite" }} />
            <span style={{ color: "#00aaff", fontSize: 11 }}>online</span>
          </div>
        </div>

        {/* Mensagens */}
        <div ref={listRef} className="chat-messages"
          style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 12px", background: "#0a0a0f", scrollbarWidth: "thin", scrollbarColor: "#0066ff transparent", position: "relative" }}>

          {/* Marca d'água */}
          <img src="/logo-krro.png" alt="" aria-hidden="true"
            style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "70%", maxWidth: 300, opacity: 0.04, pointerEvents: "none", zIndex: 0, objectFit: "contain", filter: "brightness(0) invert(1)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 10, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "78%",
                  padding: "10px 14px",
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: m.role === "user" ? "#0066ff" : "#0d1117",
                  borderLeft: m.role === "assistant" ? "2px solid #0066ff" : "none",
                  color: "#ffffff",
                  fontSize: 14,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {showCards && <FounderCards city={driverCity} onSelect={handleSelectLot} />}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                <div style={{ background: "#0d1117", borderLeft: "2px solid #0066ff", borderRadius: "18px 18px 18px 4px", padding: "12px 16px" }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div style={{ background: "#000000", borderTop: "1px solid #0066ff", padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-end", flexShrink: 0, paddingBottom: "max(10px, env(safe-area-inset-bottom))", position: "relative", zIndex: 10 }}>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={loading}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            style={{ flex: 1, padding: "10px 14px", background: "#0d1117", border: "1px solid #0066ff33", borderRadius: 20, color: "#ffffff", fontSize: 14, outline: "none", opacity: loading ? 0.5 : 1, transition: "box-shadow 0.2s" }}
          />
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{ width: 40, height: 40, borderRadius: "50%", background: "#0066ff", border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer", opacity: loading || !input.trim() ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}>
            <svg viewBox="0 0 24 24" fill="white" width={18} height={18}>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
