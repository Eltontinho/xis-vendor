// ⚠️ NUNCA EDITE lib/elton/system.ts VIA ESTE AGENTE. Prompt gerenciado manualmente.
"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "elton" | "system";
  content: string;
  timestamp: number;
  image?: string;
}

type CardType = "apresentacao" | "comparativo" | "clube" | "pagamento";
interface CardData {
  ganhoAtual?: number;
  ganhoKRRO?: number;
}

// ─── Card Components ──────────────────────────────────────────────────────────

function CardApresentacao({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg z-10">×</button>
      <img src="/cardk-rrofundopreto.png" alt="K-RRO" className="max-w-sm w-full rounded-2xl" />
    </div>
  );
}

function CardComparativo({ data, onClose }: { data?: CardData; onClose: () => void }) {
  const atual = data?.ganhoAtual ?? 0;
  const krro  = data?.ganhoKRRO  ?? 0;
  const max   = Math.max(atual, krro, 1);
  const extra = krro - atual;
  const fmt   = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
      <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center text-lg">×</button>
      <h2 className="text-lg font-bold text-white mb-1">Conta de Padaria</h2>
      <p className="text-xs text-gray-400 mb-5">Comparativo diário — mesma rota, taxa diferente</p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-400">Plataforma atual</span>
            <span className="font-bold text-red-400">{fmt(atual)}/dia</span>
          </div>
          <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
            <div className="h-full bg-red-500/70 rounded-lg transition-all duration-700" style={{ width: `${(atual / max) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-400">K-RRO Platina (94%)</span>
            <span className="font-bold text-green-400">{fmt(krro)}/dia</span>
          </div>
          <div className="h-8 bg-gray-800 rounded-lg overflow-hidden">
            <div className="h-full bg-green-500/80 rounded-lg transition-all duration-700" style={{ width: `${(krro / max) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 bg-green-900/30 border border-green-700/40 rounded-xl p-4 text-center">
        <p className="text-xs text-gray-400 mb-1">Diferença no seu bolso</p>
        <p className="text-2xl font-black text-green-400">{fmt(extra)}<span className="text-sm font-normal">/dia</span></p>
        <p className="text-sm text-green-300 mt-1">{fmt(extra * 20)}/mês · {fmt(extra * 240)}/ano</p>
      </div>
    </div>
  );
}

function CardClube({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg z-10">×</button>
      <img src="/clube-todos.png" alt="Clube K-RRO" className="max-w-sm w-full rounded-2xl" />
    </div>
  );
}

function CardPagamento({ onClose }: { onClose: () => void }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
      <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center text-lg">×</button>
      <div className="text-4xl mb-3">🔐</div>
      <h2 className="text-lg font-bold text-white mb-1">Garantir Vaga de Fundador</h2>
      <p className="text-xs text-gray-400 mb-5">Seu consultor vai enviar o link exclusivo agora mesmo.</p>
      <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-400">Aceitamos</p>
        <p className="text-sm font-semibold text-white mt-1">Pix · Cartão de crédito (6×) · Débito</p>
      </div>
      <p className="text-xs text-gray-600">Acesso liberado em até 24h após confirmação do pagamento.</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id:        "welcome",
      role:      "elton",
      content:   "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput]         = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeCard, setActiveCard]   = useState<{ type: CardType; data?: CardData } | null>(null);
  const [showSplash, setShowSplash]   = useState(true);

  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 1) inputRef.current?.focus();
  }, []);

  const handleSendText = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id:        Date.now().toString(),
      role:      "user",
      content:   textToSend,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (typeof window !== "undefined" && window.innerWidth < 768) {
      inputRef.current?.blur();
    }

    try {
      const response = await fetch("/api/elton", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message: textToSend,
          history: messages
            .filter(m => m.role !== "system")
            .map(m => ({
              role:    m.role === "elton" ? "assistant" : "user",
              content: m.content,
            })),
        }),
      });

      const data = await response.json();

      if (data.message) {
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), role: "elton", content: data.message, timestamp: Date.now() },
        ]);
      }

      // Card trigger
      if (data.card?.type) {
        const cardData: CardData = {
          ganhoAtual: data.card.data?.ATUAL,
          ganhoKRRO:  data.card.data?.KRRO,
        };
        setTimeout(() => setActiveCard({ type: data.card.type.toLowerCase() as CardType, data: cardData }), 600);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "elton", content: "Problema na conexão. Tente novamente.", timestamp: Date.now() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream      = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setIsLoading(true);
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        try {
          const res  = await fetch("/api/transcribe", { method: "POST", body: formData });
          const data = await res.json();
          if (data.transcription) await handleSendText(data.transcription);
          else alert("Não consegui entender o áudio.");
        } catch {
          alert("Erro ao transcrever áudio.");
        } finally {
          setIsLoading(false);
          setIsRecording(false);
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      alert("Permita o microfone para enviar áudios.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setMessages(prev => [
          ...prev,
          { id: Date.now().toString(), role: "user", content: "📷 Foto enviada", timestamp: Date.now(), image: base64 },
        ]);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    }
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button
          onClick={() => setShowSplash(false)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700 z-10"
        >
          ×
        </button>
        <img src="/krro-apresentacao.png" alt="K-RRO" className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
        <div>
          <h1 className="font-bold text-lg">Elton</h1>
          <p className="text-xs text-gray-400">Consultor K-RRO</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-xs text-green-500">online</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user" ? "bg-blue-600 rounded-tr-none" : "bg-gray-800 rounded-tl-none"
            }`}>
              {msg.image && (
                <div className="mb-2">
                  <img src={msg.image} alt="Upload" className="max-w-full rounded-lg max-h-48 object-cover" />
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <span className="text-[10px] text-gray-400 block mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-3 pb-6 z-50">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 hover:bg-gray-600 shrink-0"
          >
            📷
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(input); } }}
            placeholder="Digite uma mensagem..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 rounded-full px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none border border-gray-700 focus:border-blue-500"
          />
          {input.trim() ? (
            <button
              onClick={() => handleSendText(input)}
              disabled={isLoading}
              className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-500 disabled:opacity-50 shrink-0"
            >
              <svg className="w-5 h-5 text-white rotate-90" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                isRecording ? "bg-red-600 animate-pulse" : "bg-gray-700 hover:bg-gray-600"
              }`}
            >
              🎤
            </button>
          )}
        </div>
      </div>

      {/* Card Modal */}
      {activeCard && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveCard(null)}
        >
          <div className="relative" onClick={e => e.stopPropagation()}>
            {activeCard.type === "apresentacao" && <CardApresentacao onClose={() => setActiveCard(null)} />}
            {activeCard.type === "comparativo"  && <CardComparativo  data={activeCard.data} onClose={() => setActiveCard(null)} />}
            {activeCard.type === "clube"         && <CardClube        onClose={() => setActiveCard(null)} />}
            {activeCard.type === "pagamento"     && <CardPagamento    onClose={() => setActiveCard(null)} />}
          </div>
        </div>
      )}
    </div>
  );
}
