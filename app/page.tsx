"use client";

import { useState, useRef, useEffect } from "react";
import CadastroForm from "@/components/CadastroForm";
import CardModal from "@/components/CardModal";

type Message = {
  id: string;
  role: "user" | "elton";
  text?: string;
  audioUrl?: string;
  image?: string;
  timestamp: number;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function getSessionId() {
  if (typeof window === "undefined") return `ssr_${Date.now()}`;
  const key = "elton_session";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

const PLAN_META = {
  platina: { label: "Platina", valor: "R$397/ano", lot: "lote3" },
  ouro:    { label: "Ouro",    valor: "R$347/ano", lot: "lote2" },
  prata:   { label: "Prata",   valor: "R$297/ano", lot: "lote1" },
} as const;

type PlanKey = keyof typeof PLAN_META;

export default function EltonChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [vagas, setVagas] = useState(42);
  const [isRecording, setIsRecording] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [showIntroCard, setShowIntroCard] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLAN_META[PlanKey]>(PLAN_META.platina);
  const [membroNumero, setMembroNumero] = useState<string | null>(null);

  const [sessionId] = useState<string>(() =>
    typeof window !== "undefined" ? getSessionId() : `ssr_${Date.now()}`
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const apiCallCountRef = useRef(0);
  const cardKRROEnviadoRef = useRef(false);
  const cardClubeEnviadoRef = useRef(false);
  const cardPlanoEnviadoRef = useRef(false);
  const followUpKRRORef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpClubeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/elton/vagas")
      .then(r => r.json())
      .then(d => setVagas(d.vagas ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showIntroCard) handleIntroClose();
      else if (modalImage) setModalImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showIntroCard, modalImage]);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      if (followUpKRRORef.current) clearTimeout(followUpKRRORef.current);
      if (followUpClubeRef.current) clearTimeout(followUpClubeRef.current);
    };
  }, []);

  function typeMessage(id: string, fullText: string, timestamp: number, image?: string): Promise<void> {
    return new Promise(resolve => {
      if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }
      setTypingMessageId(id);
      setMessages(prev => [...prev, { id, role: "elton" as const, text: "", image, timestamp }]);
      if (!fullText) { setTypingMessageId(null); resolve(); return; }
      let i = 0;
      typingIntervalRef.current = setInterval(() => {
        i++;
        const current = fullText.slice(0, i);
        const done = i >= fullText.length;
        setMessages(prev => prev.map(m => m.id === id ? { ...m, text: current } : m));
        if (done) {
          clearInterval(typingIntervalRef.current!);
          typingIntervalRef.current = null;
          setTypingMessageId(null);
          resolve();
        }
      }, 18);
    });
  }

  function cancelFollowUps() {
    if (followUpKRRORef.current) { clearTimeout(followUpKRRORef.current); followUpKRRORef.current = null; }
    if (followUpClubeRef.current) { clearTimeout(followUpClubeRef.current); followUpClubeRef.current = null; }
  }

  function handleIntroClose() {
    setShowIntroCard(false);
    setTimeout(() => {
      typeMessage(generateId(), "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?", Date.now());
    }, 300);
  }

  async function fetchNextNumber(lot: string) {
    try {
      const res = await fetch(`/api/reserve/next-number?lot=${lot}`);
      const data = await res.json();
      const num = data.number ?? Math.floor(Math.random() * 90) + 10;
      const suffix = lot === "lote3" ? "PL" : lot === "lote2" ? "OU" : "PR";
      setMembroNumero(`${String(num).padStart(3, "0")}${suffix}`);
    } catch { /* silently ignore */ }
  }

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
      console.log("[RESERVE]", data);
      setShowForm(false);
      typeMessage(generateId(), data.success && data.checkout_url
        ? `Aqui está seu link de pagamento: ${data.checkout_url}\n\nVálido por 15 minutos. Qualquer dúvida é só chamar.`
        : data.error
        ? `Erro ao gerar o link: ${data.error}. Me chama que resolvo.`
        : "Tive um problema técnico ao gerar o link. Me chama em instantes que resolvo.", Date.now());
    } catch (err) {
      console.error("[CADASTRO]", err);
      setShowForm(false);
      typeMessage(generateId(), "Tive um problema técnico ao gerar o link. Me chama em instantes que resolvo.", Date.now());
    } finally {
      setFormLoading(false);
    }
  }

  async function sendText(text: string) {
    if (!text.trim() || loading || typingMessageId !== null) return;

    if (text.trim() === "/reset") {
      localStorage.clear();
      window.location.reload();
      return;
    }

    cancelFollowUps();
    if (showForm) setShowForm(false);

    const userMsg: Message = { id: generateId(), role: "user", text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
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
        typeMessage(generateId(), data.message, Date.now());

        const msgLower = data.message.toLowerCase();

        // Após primeiro response (nome): 2s → card K-RRO + 8s follow-up
        if (apiCallCountRef.current === 1 && !cardKRROEnviadoRef.current) {
          cardKRROEnviadoRef.current = true;
          setTimeout(async () => {
            await typeMessage(generateId(), "Vou te mostrar um pouquinho da K-RRO", Date.now());
            setMessages(prev => [...prev, {
              id: generateId(), role: "elton" as const,
              image: "/cards/cardk-rrofundopreto.png",
              timestamp: Date.now(),
            }]);
            followUpKRRORef.current = setTimeout(() => {
              followUpKRRORef.current = null;
              typeMessage(generateId(), "O que você achou do card?", Date.now());
            }, 8000);
          }, 2000);
        }

        // Clube card: AI menciona Clube K-RRO → 800ms → card + 8s follow-up
        if ((msgLower.includes("clube k-rro") || msgLower.includes("clube de benefícios")) && !cardClubeEnviadoRef.current) {
          cardClubeEnviadoRef.current = true;
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: generateId(), role: "elton" as const,
              image: "/cards/clube-todos.png",
              timestamp: Date.now(),
            }]);
            followUpClubeRef.current = setTimeout(() => {
              followUpClubeRef.current = null;
              typeMessage(generateId(), "Qual dos planos fez mais sentido pra você?", Date.now());
            }, 8000);
          }, 800);
        }

        // Card do plano: AI confirma plano específico com preço e percentual
        const hasPrice = data.message.includes("R$397") || data.message.includes("R$347") || data.message.includes("R$297");
        const hasROI   = data.message.includes("94%")   || data.message.includes("92%")   || data.message.includes("90%");
        if (hasPrice && hasROI && !cardPlanoEnviadoRef.current) {
          const planImg = data.message.includes("Platina") ? "/cards/clube-platina.jpg"
            : data.message.includes("Ouro") ? "/cards/clube-ouro.jpg"
            : data.message.includes("Prata") ? "/cards/clube-prata.jpg" : null;
          if (planImg) {
            cardPlanoEnviadoRef.current = true;
            const src = planImg;
            setTimeout(() => {
              setMessages(prev => [...prev, {
                id: generateId(), role: "elton" as const,
                image: src,
                timestamp: Date.now(),
              }]);
            }, 600);
          }
        }

        // Formulário: abre quando Elton confirma plano e menciona cadastro
        const cadastroTriggers = ["formulário", "garantir sua vaga", "número de membro", "reservar seu número"];
        if (cadastroTriggers.some(t => msgLower.includes(t))) {
          const planKey = (["platina", "ouro", "prata"] as const).find(p =>
            msgLower.includes(p) || messages.some(m => m.role === "elton" && m.text?.toLowerCase().includes(p))
          ) ?? "platina";
          const plan = PLAN_META[planKey];
          setSelectedPlan(plan);
          fetchNextNumber(plan.lot);
          setShowForm(true);
        }
      }
    } catch {
      typeMessage(generateId(), "Sistema instável. Tente novamente.", Date.now());
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
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setMessages(prev => [...prev, { id: generateId(), role: "user", audioUrl: url, timestamp: Date.now() }]);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mrRef.current = mr;
      setIsRecording(true);
    } catch { /* mic unavailable */ }
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
        @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      `}</style>

      {/* Card de entrada — tela cheia ao carregar */}
      {showIntroCard && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "#000",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/cards/krro-apresentação.png"
            alt="K-RRO"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
          <button
            onClick={handleIntroClose}
            aria-label="Fechar"
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 32,
              cursor: "pointer",
              lineHeight: 1,
              padding: "8px 12px",
              minWidth: 44,
              minHeight: 44,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Chat */}
      <div
        className="relative w-full max-w-[480px] flex flex-col overflow-hidden"
        style={{
          height: "100dvh",
          maxHeight: "100dvh",
          backgroundColor: "#0a0a0f",
          boxShadow: "0 0 40px rgba(0,102,255,0.25), inset 0 0 0 1px rgba(0,102,255,0.15)",
        }}
      >
        {/* Header */}
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

        {/* Mensagens */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: "#0a0a0f" }}>
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
          <div className="absolute inset-0 overflow-y-auto px-3 py-4 space-y-2" style={{ zIndex: 1 }}>
            {messages.map((msg) => {
              const isElton = msg.role === "elton";
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-1.5 ${isElton ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className="max-w-[78%] px-3 py-2 text-sm leading-snug"
                    style={
                      isElton
                        ? { backgroundColor: "#0d1117", borderLeft: "3px solid #0066ff", color: "#e0e0e0", borderRadius: "0 12px 12px 12px" }
                        : { backgroundColor: "#0066ff", color: "#ffffff", borderRadius: "12px 12px 0 12px" }
                    }
                  >
                    {msg.audioUrl ? (
                      <audio controls src={msg.audioUrl} className="max-w-[220px]" style={{ height: 36 }} />
                    ) : (
                      <>
                        {typeof msg.text === "string" && (
                          <p className="whitespace-pre-wrap break-words">
                            {msg.text}
                            {typingMessageId === msg.id && (
                              <span style={{ animation: "blink 1s step-end infinite" }}>|</span>
                            )}
                          </p>
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
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span suppressHydrationWarning className="text-[10px] tabular-nums font-mono" style={{ color: "#666666" }}>
                        {formatTime(msg.timestamp)}
                      </span>
                      {!isElton && <span className="text-[11px] leading-none text-white opacity-80">✓✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && !typingMessageId && (
              <div className="flex items-end justify-start">
                <div
                  className="px-4 py-3"
                  style={{ backgroundColor: "#0d1117", borderLeft: "3px solid #0066ff", borderRadius: "0 12px 12px 12px" }}
                >
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map(delay => (
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
                    membroNumero={membroNumero ?? undefined}
                    onSubmit={handleCadastroSubmit}
                  />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
          style={{ backgroundColor: "#000000", borderTop: "1px solid #0066ff" }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); }
            }}
            placeholder="Digite uma mensagem"
            disabled={loading || typingMessageId !== null || showIntroCard}
            className="page-input flex-1 rounded-full px-4 py-2 text-sm outline-none transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#0d1117", border: "1px solid #222", color: "#ffffff" }}
          />

          {input.trim() ? (
            <button
              onClick={() => sendText(input)}
              disabled={loading || typingMessageId !== null}
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
              onTouchStart={e => { e.preventDefault(); startRecording(); }}
              onTouchEnd={e => { e.preventDefault(); stopRecording(); }}
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

      {modalImage && <CardModal src={modalImage} onClose={() => setModalImage(null)} />}
    </div>
  );
}
