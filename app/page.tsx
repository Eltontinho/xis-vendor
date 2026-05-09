"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "elton";
  text?: string;
  audioUrl?: string;
  image?: string;
  timestamp: number;
};


const formatTime = (ts: number) => {
  const [h, m] = new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).split(":");
  return `${h}:${m}`;
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function getSessionId() {
  const key = "elton_session";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

const INITIAL: Message = {
  id: "init",
  role: "elton",
  text: "Opa! Sou o Elton, consultor da K-RRO. Qual é o seu nome?",
  timestamp: Date.now(),
};

export default function EltonChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [vagas, setVagas] = useState(42);
  const [isRecording, setIsRecording] = useState(false);
  const cardEnviadoRef = useRef(false);
  const apiCallCountRef = useRef(0);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [sessionId] = useState<string>(() =>
    typeof window !== "undefined" ? getSessionId() : `ssr_${Date.now()}`
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch("/api/elton/vagas")
      .then((r) => r.json())
      .then((d) => setVagas(d.vagas ?? 0))
      .catch(() => {});
  }, []);

  // Carrega histórico salvo ao montar
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/elton/historico?phone=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((d) => {
        const history: { role: string; content: string }[] = d.history ?? [];
        if (history.length === 0) return;
        cardEnviadoRef.current = true;
        const restored: Message[] = history.map((h, i) => ({
          id: `hist_${i}`,
          role: h.role === "assistant" ? "elton" : "user",
          text: h.content,
          timestamp: Date.now() - (history.length - i) * 1000,
        }));
        setMessages(restored);
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!modalImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModalImage(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalImage]);

  async function sendText(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      text: text.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/elton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), phone: sessionId, vagas }),
      });
      const data = await res.json();
      if (data.message) {
        apiCallCountRef.current += 1;
        const eltonMsg: Message = {
          id: generateId(),
          role: "elton",
          text: data.message,
          // nunca inclui a imagem de apresentação via API — o timer client-side cuida disso
          image: data.image === '/cards/krro-apresentacao.jpg' ? undefined : data.image,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, eltonMsg]);
        setTimeout(() => inputRef.current?.focus(), 50);

        if (!cardEnviadoRef.current && apiCallCountRef.current === 1) {
          cardEnviadoRef.current = true;
          const followUps = [
            'Fez sentido pra você?',
            'O que mais te chamou atenção?',
            'Alguma coisa te surpreendeu?',
            'O que achou?',
          ];
          const followUp = followUps[Math.floor(Math.random() * followUps.length)];
          setMessages(prev => [...prev, {
            id: generateId(),
            role: 'elton',
            image: '/cards/krro-apresentacao.jpg',
            timestamp: Date.now(),
          }]);
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateId(),
              role: 'elton',
              text: followUp,
              timestamp: Date.now(),
            }]);
          }, 10000);
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "elton",
          text: "Sistema instável. Tente novamente.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "user",
            audioUrl: url,
            timestamp: Date.now(),
          },
        ]);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mrRef.current = mr;
      setIsRecording(true);
    } catch {
      // microfone não disponível ou permissão negada
    }
  }

  function stopRecording() {
    mrRef.current?.stop();
    mrRef.current = null;
    setIsRecording(false);
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div
        className="relative w-full max-w-[480px] flex flex-col overflow-hidden"
        style={{
          height: "100dvh",
          maxHeight: "100dvh",
          backgroundColor: "#000000",
          border: "1px solid #1B5CB8",
          borderRadius: 12,
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-4 py-3 z-10 flex-shrink-0"
          style={{ backgroundColor: "#000000", borderBottom: "1px solid #1B5CB8" }}
        >
          <img
            src="/logo-krro.jpg"
            alt="K-RRO"
            style={{ height: 28, objectFit: "contain", flexShrink: 0 }}
          />
          <img
            src="/elton-avatar.png"
            alt="Elton"
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-light text-sm leading-tight text-white tracking-wide">
              Elton — Consultor
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-[11px] font-mono" style={{ color: "#8899AA" }}>online</span>
          </div>
          {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="text-[10px] transition-colors flex-shrink-0 px-2 py-0.5 rounded"
              style={{ color: "#4A8FD4", border: "1px solid #1B5CB8" }}
              title="Limpar sessão (apenas dev)"
            >
              Nova conversa
            </button>
          )}
        </div>

        {/* ── Área de mensagens com watermark ── */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>
          {/* Logo watermark centralizada */}
          <img
            src="/logo-krro-dark.png"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 440,
              opacity: 0.08,
              mixBlendMode: "screen",
              pointerEvents: "none",
              zIndex: 0,
              userSelect: "none",
            }}
          />

          {/* Mensagens (scrollável, sobre a watermark) */}
          <div
            className="absolute inset-0 overflow-y-auto px-3 py-4 space-y-2"
            style={{ zIndex: 1 }}
          >
            {messages.map((msg) => {
              const isElton = msg.role === "elton";
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-1.5 ${isElton ? "justify-start" : "justify-end"}`}
                >
                  {/* Avatar miniatura Elton */}
                  {isElton && (
                    <img
                      src="/elton-avatar.png"
                      alt=""
                      aria-hidden="true"
                      style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginBottom: 2 }}
                    />
                  )}
                  {/* Balão */}
                  <div
                    className="max-w-[78%] px-3 py-2 text-sm leading-snug"
                    style={
                      isElton
                        ? {
                            backgroundColor: "#F0F4FF",
                            borderLeft: "3px solid #1B5CB8",
                            color: "#1A1A1A",
                            borderRadius: "0 12px 12px 12px",
                          }
                        : {
                            backgroundColor: "#1B5CB8",
                            color: "#FFFFFF",
                            borderRadius: "12px 12px 0 12px",
                          }
                    }
                  >
                    {msg.audioUrl ? (
                      <audio
                        controls
                        src={msg.audioUrl}
                        className="max-w-[220px]"
                        style={{ height: 36 }}
                      />
                    ) : (
                      <>
                        {msg.text && (
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        )}
                        {msg.image && (
                          <img
                            src={msg.image}
                            alt=""
                            className="mt-2 rounded-xl w-full max-w-[260px] object-cover"
                            style={{ cursor: "pointer" }}
                            onClick={() => setModalImage(msg.image!)}
                          />
                        )}
                      </>
                    )}

                    {/* Timestamp + ticks */}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span
                        suppressHydrationWarning
                        className="text-[10px] tabular-nums font-mono"
                        style={{ color: "#888888" }}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                      {!isElton && (
                        <span className="text-[11px] leading-none text-white opacity-80">✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-end justify-start">
                <div
                  className="px-4 py-3"
                  style={{
                    backgroundColor: "#F0F4FF",
                    borderLeft: "3px solid #1B5CB8",
                    borderRadius: "0 12px 12px 12px",
                  }}
                >
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ backgroundColor: "#1B5CB8", animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input ── */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
          style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #1B5CB8" }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText(input);
              }
            }}
            placeholder="Digite uma mensagem"
            disabled={loading}
            className="flex-1 rounded-full px-4 py-2 text-sm outline-none transition-colors disabled:opacity-40"
            style={{
              backgroundColor: "#F5F5F5",
              border: "1px solid #1B5CB8",
              color: "#1A1A1A",
            }}
          />

          {/* Enviar (texto) ou Microfone */}
          {input.trim() ? (
            <button
              onClick={() => sendText(input)}
              disabled={loading}
              aria-label="Enviar mensagem"
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: "#1B5CB8" }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 translate-x-0.5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
              aria-label={isRecording ? "Gravando — solte para enviar" : "Segure para gravar"}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ backgroundColor: isRecording ? "#ef4444" : "#1B5CB8" }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Modal de imagem ── */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
          onClick={() => setModalImage(null)}
        >
          <img
            src={modalImage}
            alt=""
            className="object-contain"
            style={{ maxWidth: "100vw", maxHeight: "100vh" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setModalImage(null)}
            className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full text-white text-lg font-light transition-colors"
            style={{ backgroundColor: "rgba(27,92,184,0.7)" }}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
