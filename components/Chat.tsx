"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ChatBubble from "./ChatBubble";
import TypingIndicator from "./TypingIndicator";
import FounderCards from "./FounderCards";
import { ChatMessage, LotName, ReserveResponse } from "@/lib/types";
import { getLocationFromIP } from "@/lib/geolocation";
import { trackChatStarted, trackPurchase, trackViewClubeKRRO } from "@/lib/analytics";

const INITIAL_MESSAGE: ChatMessage = {
  id: "init",
  role: "axis",
  content: "Oi! Sou o Elton, consultor da K-RRO. Qual é o seu nome?",
  timestamp: new Date().toISOString(),
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

interface ChatProps {
  reservedNumber?: number;
}

export default function Chat({ reservedNumber }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [driverCity, setDriverCity] = useState<string>("");
  const [showCards, setShowCards] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isBusy = isThinking || isStreaming;

  useEffect(() => {
    getLocationFromIP().then((loc) => {
      if (loc?.city) setDriverCity(loc.city);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pagamento") === "aprovado") {
      const value = parseFloat(params.get("value") ?? "0");
      trackPurchase(value);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [messages, isThinking, isStreaming, showCards]);

  const handleSelectPlan = useCallback((lot: number) => {
    const planNames: Record<number, string> = {
      1: "BLACK",
      2: "SILVER",
      3: "PLATINUM",
    };
    const planName = planNames[lot] ?? `Lote ${lot}`;
    setShowCards(false);
    sendMessage(`Quero o ${planName}`);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isBusy) return;

      const isFirstUserMessage = !messages.some((m) => m.role === "user");
      if (isFirstUserMessage) trackChatStarted();

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const history = messages.map((m) => ({
        role: m.role === "axis" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsThinking(true);

      const axisId = generateId();
      let gotFirstToken = false;
      let localConvId = conversationId;
      let streamedContent = "";

      try {
        const res = await fetch("/api/axis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMsg.content,
            conversationId,
            history,
            driverCity: driverCity || undefined,
            reservedNumber: reservedNumber ?? undefined,
          }),
        });

        if (!res.body) throw new Error("No stream body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);

            if (data.startsWith("[META]")) {
              try {
                const meta = JSON.parse(data.slice(6)) as { conversationId?: string };
                if (meta.conversationId) {
                  setConversationId(meta.conversationId);
                  localConvId = meta.conversationId;
                }
              } catch { }
              continue;
            }

            let token: string;
            try {
              token = JSON.parse(data) as string;
            } catch {
              token = data;
            }

            if (!token) continue;

            await new Promise<void>((r) => setTimeout(r, 40));
            streamedContent += token;

            if (!gotFirstToken) {
              gotFirstToken = true;
              setIsThinking(false);
              setIsStreaming(true);
              setMessages((prev) => [
                ...prev,
                {
                  id: axisId,
                  role: "axis",
                  content: token,
                  timestamp: new Date().toISOString(),
                },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === axisId ? { ...m, content: m.content + token } : m
                )
              );
            }
          }
        }

        // Detecta {{CLUBE_KRRO}} e renderiza cards
        if (streamedContent.includes("{{CLUBE_KRRO}}")) {
          trackViewClubeKRRO();
          setShowCards(true);
          // Remove o token da mensagem
          setMessages((prev) =>
            prev.map((m) =>
              m.id === axisId
                ? { ...m, content: streamedContent.replace("{{CLUBE_KRRO}}", "").trim() }
                : m
            )
          );
        }

        // Detecta confirmação de pagamento
        const paymentConfirmRe =
          /pagamento\s+(confirmado|aprovado|realizado)|você\s+está\s+dentro|bem[-\s]vindo\s+(à|a)\s+k[-\s]rro/i;
        if (paymentConfirmRe.test(streamedContent)) {
          trackPurchase(0);
        }

        // Resolve placeholder de checkout [lote...N...]
        const placeholderRe = /\[[^\]]*lote[^\]]*([1-3])[^\]]*\]/i;
        const match = streamedContent.match(placeholderRe);

        if (match && localConvId) {
          const lot = `lote${match[1]}` as LotName;
          try {
            const reserveRes = await fetch("/api/reserve", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                driver_phone: "",
                driver_name: "",
                driver_city: driverCity || "",
                lot,
                conversation_id: localConvId,
              }),
            });
            const reserveData: ReserveResponse = await reserveRes.json();

            let replacement: string;
            if (reserveData.success && reserveData.checkout_url) {
              replacement = reserveData.checkout_url;
            } else if (reserveData.available === false) {
              const nextLot = Number(match[1]) < 3 ? Number(match[1]) + 1 : null;
              replacement = nextLot
                ? `Lote ${match[1]} esgotado. Posso ver o Lote ${nextLot}?`
                : `Todas as vagas estão esgotadas.`;
            } else {
              replacement = match[0];
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === axisId
                  ? { ...m, content: streamedContent.replace(match[0], replacement) }
                  : m
              )
            );
          } catch { }
        }

      } catch {
        setIsThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "axis",
            content: "Ops, tive um problema de conexão. Pode tentar novamente? 🙏",
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsThinking(false);
        setIsStreaming(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [isBusy, conversationId, messages, driverCity, reservedNumber]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5]">
      {/* Header */}
      <div className="bg-[#075e54] text-white px-4 py-3 flex items-center gap-3 shadow-md z-10 flex-shrink-0">
        <img
          src="/logo-krro.png"
          alt="K-RRO"
          style={{ height: "32px", objectFit: "contain", flexShrink: 0 }}
        />
        <div>
          <p className="font-semibold text-sm leading-tight">Elton</p>
          <p className="text-xs text-green-200">Consultor K-RRO</p>
        </div>
      </div>

      {/* Mensagens */}
      <div className="relative flex-1 overflow-y-auto py-4 min-h-0 bg-[#f5f5f5]">
        <img
          src="/logo-krro.png"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "600px",
            opacity: 0.20,
            pointerEvents: "none",
            zIndex: 0,
            objectFit: "contain",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isThinking && <TypingIndicator />}
          {showCards && (
            <div className="px-4 py-2">
              <FounderCards
                driverCity={driverCity}
                onSelect={handleSelectPlan}
              />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-[#f0f0f0] px-2 py-2 flex items-end gap-2 border-t border-gray-200 flex-shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem"
          rows={1}
          disabled={isBusy}
          className="flex-1 bg-white rounded-2xl px-4 py-2.5 text-[15px] resize-none outline-none border-none shadow-sm max-h-[120px] overflow-y-auto leading-snug disabled:opacity-50 transition-opacity"
          style={{ height: "42px" }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isBusy}
          className="w-10 h-10 rounded-full bg-[#075e54] flex items-center justify-center shadow-md disabled:opacity-40 transition-opacity flex-shrink-0"
          aria-label="Enviar"
        >
          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 translate-x-0.5">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}