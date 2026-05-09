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
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Streaming refs — avoid state churn during rAF loop
  const streamBufRef = useRef("");
  const rafPendingRef = useRef(false);
  const streamMsgIdRef = useRef("");

  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    setTimeout(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }

  // Schedules a single rAF to flush streamBufRef into the streaming message
  function scheduleRenderUpdate() {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      const content = streamBufRef.current;
      const id = streamMsgIdRef.current;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content } : m))
      );
    });
  }

  async function sendMessage(text?: string) {
    const msgText = (text ?? input).trim();
    if (!msgText || loading) return;

    if (!text) setInput("");

    const userMsgId = generateId();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: msgText },
    ]);
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
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
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

          // META event — extract conversationId
          if (data.startsWith("[META]")) {
            try {
              const meta = JSON.parse(data.slice(6)) as {
                conversationId?: string;
              };
              if (meta.conversationId) {
                setConversationId(meta.conversationId);
                localConvId = meta.conversationId;
              }
            } catch {}
            continue;
          }

          // Text chunk
          let chunk: string;
          try {
            chunk = JSON.parse(data) as string;
          } catch {
            chunk = data;
          }
          if (!chunk) continue;

          streamBufRef.current += chunk;

          if (!gotFirst) {
            // First chunk: create the assistant message
            gotFirst = true;
            setLoading(false);
            setMessages((prev) => [
              ...prev,
              {
                id: axisId,
                role: "assistant",
                content: streamBufRef.current,
              },
            ]);
          } else {
            scheduleRenderUpdate();
          }
        }
      }

      // Cancel any pending rAF — do a final synchronous flush
      rafPendingRef.current = false;
      const fullText = streamBufRef.current;

      // Post-process: {{CLUBE_KRRO}}
      let finalText = fullText;
      if (fullText.includes("{{CLUBE_KRRO}}")) {
        setShowCards(true);
        finalText = fullText.replace("{{CLUBE_KRRO}}", "").trim();
      }

      // Post-process: [lote...N...] placeholder → checkout URL
      const loteMatch = finalText.match(/\[[^\]]*lote[^\]]*([1-3])[^\]]*\]/i);
      if (loteMatch && localConvId) {
        const lot = `lote${loteMatch[1]}`;
        try {
          const reserveRes = await fetch("/api/reserve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lot,
              conversation_id: localConvId,
              driver_city: driverCity || "",
            }),
          });
          const reserveData = await reserveRes.json();
          if (reserveData.success && reserveData.checkout_url) {
            finalText = finalText.replace(
              loteMatch[0],
              reserveData.checkout_url
            );
          } else if (reserveData.available === false) {
            const nextN =
              Number(loteMatch[1]) < 3 ? Number(loteMatch[1]) + 1 : null;
            finalText = finalText.replace(
              loteMatch[0],
              nextN
                ? `Lote ${loteMatch[1]} esgotado. Posso ver o Lote ${nextN}?`
                : "Todas as vagas estão esgotadas."
            );
          }
        } catch {}
      }

      // Final state sync
      setMessages((prev) =>
        prev.map((m) => (m.id === axisId ? { ...m, content: finalText } : m))
      );
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content: "Deu erro aqui. Me chama de novo.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleSelectLot(lot: Lot) {
    sendMessage(`Quero o ${lot.name}`);
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages, showCards]);

  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_BUSINESS_NUMBER ?? "";
  const waHref = waNumber
    ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=Oi+Elton%2C+quero+saber+mais+sobre+a+K-RRO`
    : "#";

  return (
    <div style={{ position: "relative" }}>
      {/* Botão flutuante WhatsApp */}
      {waNumber && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Falar com o Elton no WhatsApp"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            width: 56,
            height: 56,
            borderRadius: "50%",
            backgroundColor: "#25D366",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            textDecoration: "none",
          }}
        >
          {/* WhatsApp icon */}
          <svg viewBox="0 0 24 24" fill="white" width={30} height={30}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxWidth: 520,
        margin: "0 auto",
        border: "1px solid #222",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <style>{`
        .chat-messages::-webkit-scrollbar { width: 6px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: #888; border-radius: 3px; }
        .chat-messages::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
      <div
        ref={listRef}
        className="chat-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          background: "#0f0f0f",
          scrollbarWidth: "thin",
          scrollbarColor: "#888 transparent",
        }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              marginBottom: 12,
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "10px 12px",
                borderRadius: 12,
                background: m.role === "user" ? "#2a2a2a" : "#1a1a1a",
                color: "#fff",
                fontSize: 14,
                lineHeight: 1.4,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {showCards && (
          <FounderCards city={driverCity} onSelect={handleSelectLot} />
        )}

        {loading && (
          <div style={{ color: "#777", fontSize: 12 }}>digitando...</div>
        )}
      </div>

      <div style={{ display: "flex", borderTop: "1px solid #222" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={loading}
          style={{
            flex: 1,
            padding: 12,
            background: "#0f0f0f",
            border: "none",
            color: "#fff",
            outline: "none",
            opacity: loading ? 0.5 : 1,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            padding: "0 16px",
            background: "#fff",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          Enviar
        </button>
      </div>
    </div>
    </div>
  );
}
