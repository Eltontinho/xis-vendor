"use client";

import { useState, useRef, useEffect } from "react";
import CadastroForm from "@/components/CadastroForm";

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
  text: "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?",
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
  const planFollowUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{ label: string; valor: string; lot: string }>({
    label: "Platina", valor: "R$397/ano", lot: "lote1",
  });

  const PLAN_META: Record<string, { label: string; valor: string; lot: string }> = {
    platina: { label: "Platina", valor: "R$397/ano", lot: "lote1" },
    ouro:    { label: "Ouro",    valor: "R$347/ano", lot: "lote2" },
    prata:   { label: "Prata",   valor: "R$297/ano", lot: "lote3" },
  };

  useEffect(() => {
    fetch("/api/elton/vagas")
      .then((r) => r.json())
      .then((d) => setVagas(d.vagas ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!modalImage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModalImage(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalImage]);

  async function handleCadastroSubmit(dados: { nome: string; telefone: string; email: string; placa: string; cidade: string }) {
    setFormLoading(true);
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot: selectedPlan.lot,
          conversation_id: sessionId,
          driver_phone: dados.telefone.replace(/\D/g, ""),
          driver_name: dados.nome,
          driver_city: dados.cidade,
        }),
      });
      const data = await res.json();
      setShowForm(false);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: "elton" as const,
        text: data.success && data.checkout_url
          ? `Aqui está seu link de pagamento: ${data.checkout_url}\n\nVálido por 15 minutos. Qualquer dúvida é só chamar.`
          : "Tive um problema técnico ao gerar o link. Me chama em instantes que resolvo.",
        timestamp: Date.now(),
      }]);
    } catch {
      setShowForm(false);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: "elton" as const,
        text: "Tive um problema técnico ao gerar o link. Me chama em instantes que resolvo.",
        timestamp: Date.now(),
      }]);
    } finally {
      setFormLoading(false);
    }
  }

  async function sendText(text: string) {
    if (!text.trim() || loading) return;

    if (text.trim() === "/reset") {
      localStorage.clear();
      window.location.reload();
      return;
    }

    if (showForm) setShowForm(false);

    if (planFollowUpTimerRef.current) {
      clearTimeout(planFollowUpTimerRef.current);
      planFollowUpTimerRef.current = null;
    }

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
          image: data.image === '/cards/krro-apresentacao.png' ? undefined : data.image,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, eltonMsg]);
        setTimeout(() => inputRef.current?.focus(), 50);

        // Detecta frases que indicam coleta de dados de cadastro
        const msgLower = data.message.toLowerCase();
        const cadastroTriggers = [
          "pode me passar seu nome completo",
          "me passa seu nome completo",
          "qual é o seu nome completo",
          "vou gerar seu link",
          "vou processar seu cadastro",
          "preciso do seu nome completo",
          "seu nome completo",
          "nome completo",
          "qual seu nome",
          "me passa seu nome",
          "preciso do seu nome",
          "me passa os dados",
          "vou precisar de alguns dados",
          "para gerar seu cadastro",
          "seguir com o cadastro",
          "dados para gerar",
          "whatsapp com ddd",
          "1. nome",
          "preciso de alguns dados",
        ];
        if (cadastroTriggers.some(t => msgLower.includes(t))) {
          const allMsgs = [...messages, eltonMsg];
          const planKey = (["platina", "ouro", "prata"] as const).find(p =>
            allMsgs.some(m => m.role === "elton" && m.text?.toLowerCase().includes(p))
          ) ?? "platina";
          setSelectedPlan(PLAN_META[planKey]);
          setShowForm(true);
        }

        if (!cardEnviadoRef.current && apiCallCountRef.current === 1) {
          cardEnviadoRef.current = true;
          setMessages(prev => [...prev, {
            id: generateId(),
            role: 'elton',
            image: '/cards/krro-apresentacao.png',
            timestamp: Date.now(),
          }]);
          planFollowUpTimerRef.current = setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateId(),
              role: 'elton' as const,
              text: 'O que chamou sua atenção?',
              timestamp: Date.now(),
            }]);
            planFollowUpTimerRef.current = null;
          }, 10000);
        }

        const planCardImages = ["/cards/clube-platina.jpg", "/cards/clube-ouro.jpg", "/cards/clube-prata.jpg"];
        if (data.image && planCardImages.includes(data.image)) {
          if (planFollowUpTimerRef.current) clearTimeout(planFollowUpTimerRef.current);
          const planFollowUps = [
            "Quantas horas por dia você costuma rodar?",
            "Você roda mais de dia ou à noite?",
          ];
          const planFollowUp = planFollowUps[Math.floor(Math.random() * planFollowUps.length)];
          planFollowUpTimerRef.current = setTimeout(() => {
            setMessages((prev) => [...prev, {
              id: generateId(),
              role: "elton" as const,
              text: planFollowUp,
              timestamp: Date.now(),
            }]);
            planFollowUpTimerRef.current = null;
          }, 20000);
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
    <div style={{ minHeight: "100vh", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes pulse-green { 0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,136,0.5); } 50% { box-shadow: 0 0 0 4px rgba(0,255,136,0); } }
        .page-input:focus { border-color: #0066ff !important; outline: none; box-shadow: 0 0 0 2px rgba(0,102,255,0.2); }
        .page-input::placeholder { color: #555; }
        .page-send:hover:not(:disabled) { background: #0052cc !important; }
        .page-online { animation: pulse-green 2s infinite; }
      `}</style>
      <div
        className="relative w-full max-w-[480px] flex flex-col overflow-hidden"
        style={{
          height: "100dvh",
          maxHeight: "100dvh",
          backgroundColor: "#0a0a0f",
          boxShadow: "0 0 40px rgba(0,102,255,0.25), inset 0 0 0 1px rgba(0,102,255,0.15)",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-4 py-3 z-10 flex-shrink-0"
          style={{ backgroundColor: "#0a0a0f", borderBottom: "1px solid #0066ff" }}
        >
          <img
            src="/logo-krro.png"
            alt="K-RRO"
            style={{ height: 32, objectFit: "contain", flexShrink: 0, filter: "brightness(0) invert(1)" }}
          />
          <div className="flex-1 min-w-0">
            <p style={{ color: "#ffffff", fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Elton</p>
            <p style={{ color: "#aaaaaa", fontSize: 11 }}>Consultor K-RRO</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="page-online"
              style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88", display: "inline-block", flexShrink: 0 }}
            />
            <span style={{ color: "#00ff88", fontSize: 11 }}>online</span>
          </div>
          {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="text-[10px] transition-colors flex-shrink-0 px-2 py-0.5 rounded"
              style={{ color: "#0066ff", border: "1px solid #0066ff" }}
              title="Limpar sessão (apenas dev)"
            >
              Nova conversa
            </button>
          )}
        </div>

        {/* ── Área de mensagens com watermark ── */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: "#0a0a0f" }}>
          {/* Logo watermark centralizada */}
          <img
            src="/logo-krro.png"
            alt=""
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "70%",
              maxWidth: 300,
              opacity: 0.04,
              filter: "brightness(0) invert(1)",
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
                  {/* Balão */}
                  <div
                    className="max-w-[78%] px-3 py-2 text-sm leading-snug"
                    style={
                      isElton
                        ? {
                            backgroundColor: "#0d1117",
                            borderLeft: "3px solid #0066ff",
                            color: "#e0e0e0",
                            borderRadius: "0 12px 12px 12px",
                          }
                        : {
                            backgroundColor: "#0066ff",
                            color: "#ffffff",
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
                        style={{ color: "#666666" }}
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
                    backgroundColor: "#0d1117",
                    borderLeft: "3px solid #0066ff",
                    borderRadius: "0 12px 12px 12px",
                  }}
                >
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ backgroundColor: "#0066ff", animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showForm && (
              <div className="flex items-end justify-start px-1 py-2">
                <div className="max-w-[90%] w-full">
                  <CadastroForm
                    plano={selectedPlan.label}
                    valor={selectedPlan.valor}
                    loading={formLoading}
                    onSubmit={handleCadastroSubmit}
                  />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Input ── */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
          style={{ backgroundColor: "#000000", borderTop: "1px solid #0066ff" }}
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
            className="page-input flex-1 rounded-full px-4 py-2 text-sm outline-none transition-colors disabled:opacity-40"
            style={{
              backgroundColor: "#0d1117",
              border: "1px solid #222",
              color: "#ffffff",
            }}
          />

          {/* Enviar (texto) ou Microfone */}
          {input.trim() ? (
            <button
              onClick={() => sendText(input)}
              disabled={loading}
              aria-label="Enviar mensagem"
              className="page-send w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: "#0066ff" }}
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
              style={{ backgroundColor: isRecording ? "#ef4444" : "#0066ff" }}
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
            style={{ backgroundColor: "rgba(0,102,255,0.7)" }}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
