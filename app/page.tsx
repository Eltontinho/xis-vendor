"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "elton";
  content: string;
  timestamp: number;
  image?: string;
  cardType?: string;
}

function getThinkingText(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  if (/\d{4}/.test(msg)) return "Analisando o veículo...";
  if (/corridas?|viagens?/.test(msg)) return "Calculando os números...";
  if (/ticket|recebo|ganho|valor/.test(msg)) return "Calculando os números...";
  if (/onix|creta|polo|hb20|argo|virtus|fastback|versa|kwid|fiat|jeep|toyota|honda|vw|chevrolet/.test(msg)) return "Analisando o veículo...";
  if (/porto alegre|poa|são paulo|curitiba|floripa|rio|salvador|fortaleza|canoas|gravataí|hamburgo/.test(msg)) return "Buscando informações da sua região...";
  if (/sim|quero|pode|bora|confirmo|fechado/.test(msg)) return "Preparando sua vaga...";
  if (/não|nao|depois|caro|pensar/.test(msg)) return "Entendendo sua situação...";
  if (msg.length < 15) return "Pensando...";
  return "Analisando...";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "elton", content: "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState("Pensando...");
  const [splashOpen, setSplashOpen] = useState(true);
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const [cardsShown, setCardsShown] = useState<Set<string>>(new Set());
  const [awaitingCardClose, setAwaitingCardClose] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionId] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("elton_session_v3") || `sess_${Date.now()}`
      : `sess_${Date.now()}`
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inactivityRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  useEffect(() => {
    if (messages.length < 3) return;
    if (inactivityRef.current) clearTimeout(inactivityRef.current);
    inactivityRef.current = setTimeout(() => {
      triggerAnalysis("abandonou");
    }, 10 * 60 * 1000);
    return () => { if (inactivityRef.current) clearTimeout(inactivityRef.current); };
  }, [messages]);

  const triggerAnalysis = async (resultado: "converteu" | "rejeitou" | "abandonou") => {
    if (messages.length < 3) return;
    const history = messages.map(m => ({ role: m.role === "elton" ? "assistant" : "user", content: m.content }));
    fetch("/api/elton/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, session_id: sessionId || "unknown", resultado }),
    }).catch(() => {});
  };

  const typeMessage = (msgText: string, msgId: string): Promise<void> => {
    return new Promise((resolve) => {
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: msgText.slice(0, i) } : m));
        if (i >= msgText.length) { clearInterval(iv); resolve(); }
      }, 15);
    });
  };

  const displayEltonResponse = async (fullMessage: string) => {
    const msgId = `elton-${Date.now()}`;
    setMessages(prev => [...prev, { id: msgId, role: "elton", content: "", timestamp: Date.now() }]);
    await typeMessage(fullMessage, msgId);
  };

  const cardQuestions: Record<string, string> = {
    "/cards/clube-todos.png": "Qual benefício do Clube te parece mais interessante?",
    "/cards/clube-platina.jpg": "Você se vê aproveitando esses benefícios no seu dia a dia?",
  };

  const handleCloseCard = async () => {
    const cardAtual = fullscreenCard;
    setFullscreenCard(null);

    if (!awaitingCardClose) return;

    const lastMessage = messages[messages.length - 1]?.content || "";
    if (
      lastMessage.includes("O que te chamou") ||
      lastMessage.includes("Qual benefício") ||
      lastMessage.includes("Você se vê aproveitando")
    ) {
      setAwaitingCardClose(null);
      return;
    }

    await new Promise(r => setTimeout(r, 600));
    await displayEltonResponse(
      cardQuestions[cardAtual ?? ""] ?? "O que te chamou atenção no card?"
    );
    setAwaitingCardClose(null);
  };

  const handleSendText = async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: text, timestamp: Date.now() }]);

    if (text.trim() === "eltondeoliveirak-rro@Jaelpicoe2429$$") {
      setIsAdmin(true);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "elton",
        content: "🔐 Modo dashboard ativado. O que você quer saber, Elton?",
        timestamp: Date.now()
      }]);
      return;
    }

    await sendMessageToElton(text, undefined);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: "📷 Imagem enviada", timestamp: Date.now(), image: base64 }]);
      await sendMessageToElton("Analise esta imagem.", base64);
    };
    reader.readAsDataURL(file);
  };

  const sendMessageToElton = async (text: string, base64Image?: string) => {
    setThinkingText(getThinkingText(text));
    setIsLoading(true);

    const historyPayload = messages.map(m => ({
      role: m.role === "elton" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      const endpoint = isAdmin ? "/api/elton/admin" : "/api/elton";
      const body = isAdmin
        ? JSON.stringify({ message: text, password: "eltondeoliveirak-rro@Jaelpicoe2429$$" })
        : JSON.stringify({ message: text, image: base64Image, history: historyPayload, session_id: sessionId });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();

      const msgs = data.messages || (data.message ? [data.message] : null);
      if (msgs) {
        for (const frag of msgs) {
          await displayEltonResponse(frag);
          await new Promise(r => setTimeout(r, 1500));
        }
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }

      // Link de pagamento
      if (data.checkoutUrl) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 10).toString(),
          role: "elton",
          content: `🔗 Link de pagamento: ${data.checkoutUrl}`,
          timestamp: Date.now(),
        }]);
      }

      // Análise de conversão
      const lower = (data.message || "").toLowerCase();
      if (lower.includes("bem-vindo à k-rro") && lower.includes("pagamento")) {
        triggerAnalysis("converteu");
      } else if (lower.includes("quando fizer sentido") || lower.includes("encerrando o atendimento")) {
        triggerAnalysis("rejeitou");
      }

      // Card
      if (data.card?.type && !cardsShown.has(data.card.type)) {
        setCardsShown(prev => new Set(prev).add(data.card.type));
        const cardImg = data.card.type === "clube" ? "/cards/clube-todos.png"
          : "/cards/clube-platina.jpg";
        await new Promise(r => setTimeout(r, 1500));
        setMessages(prev => [...prev, { id: (Date.now() + 2).toString(), role: "elton", content: "", timestamp: Date.now(), cardType: cardImg }]);
        setFullscreenCard(cardImg);
        setAwaitingCardClose(data.card.type);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "elton", content: `Erro: ${msg}`, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
    <div className="flex flex-col h-screen bg-[#050810]">
      <div className="flex flex-col h-full w-full max-w-[430px] mx-auto bg-black relative text-white" style={{ boxShadow: "0 0 30px rgba(59,130,246,0.15), inset 0 0 30px rgba(59,130,246,0.03)" }}>

        {/* Header */}
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/elton-avatar.png" alt="Elton" className="w-10 h-10 rounded-full object-cover object-top border-2 border-blue-500" style={{ boxShadow: "0 0 8px #3b82f6" }} />
            <div>
              <h1 className="font-bold text-white">{isAdmin ? "Dashboard K-RRO" : "Elton"}</h1>
              <p className="text-xs text-gray-400">{isAdmin ? "Painel Administrativo" : "Consultor K-RRO"}</p>
            </div>
          </div>
          <span className="text-xs text-green-500">● Online</span>
        </div>

        {/* Chat */}
        <div className="relative flex-1 overflow-y-auto bg-[#0a0f1e]">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <img src="/logo-krro.png" alt="" className="w-3/4 select-none" style={{ opacity: 0.35 }} />
          </div>
          <div className="relative p-4 space-y-4 pb-4 z-10">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-4 py-2 break-words text-sm ${
                    m.role === "user"
                      ? "bg-blue-600 rounded-2xl rounded-tr-sm text-white"
                      : isAdmin
                        ? "bg-gray-900 border-l-[3px] border-yellow-400 rounded-r-2xl text-gray-200"
                        : "bg-gray-900 border-l-[3px] border-blue-400 rounded-r-2xl text-gray-200"
                  }`}
                  style={m.role === "elton" ? { boxShadow: isAdmin ? "-3px 0 8px rgba(250,204,21,0.4)" : "-3px 0 8px rgba(96,165,250,0.4)" } : undefined}
                >
                  {m.image && <img src={m.image} alt="upload" className="max-w-full rounded-lg mb-2 max-h-60 object-contain" />}
                  {m.cardType && (
                    <img
                      src={m.cardType}
                      onClick={() => setFullscreenCard(m.cardType!)}
                      className="rounded-xl max-w-[200px] cursor-pointer"
                      alt="card"
                    />
                  )}
                  {m.content?.startsWith("🔗 Link de pagamento:") ? (
                    <a
                      href={m.content.replace("🔗 Link de pagamento: ", "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-center rounded-xl font-bold text-sm"
                      style={{ boxShadow: "0 0 12px rgba(59,130,246,0.6)" }}
                    >
                      ✅ Garantir minha vaga agora
                    </a>
                  ) : m.content ? <p className="whitespace-pre-wrap">{m.content}</p> : null}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-900 border-l-[3px] border-blue-400 rounded-r-2xl px-4 py-2 text-xs text-blue-300 italic"
                  style={{ boxShadow: "-3px 0 8px rgba(96,165,250,0.4)" }}>
                  {thinkingText}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="w-full bg-gray-900 px-4 py-3 border-t border-gray-800 flex gap-2 items-center">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 disabled:opacity-50 shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendText()}
            placeholder="Digite ou envie foto..."
            className="flex-1 min-w-0 bg-gray-800 rounded-lg px-4 py-2 outline-none text-white"
            disabled={isLoading}
          />
          <button
            onClick={handleSendText}
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 px-4 py-2 rounded-lg font-bold disabled:opacity-50 shrink-0 min-w-[44px]"
          >
            ➤
          </button>
        </div>

      </div>
    </div>

    {/* Splash inicial */}
    {splashOpen && (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button
          onClick={() => setSplashOpen(false)}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700 z-10"
        >×</button>
        <img src="/cards/krro-apresentacao.png" alt="K-RRO" className="w-full h-full object-contain" />
      </div>
    )}

    {/* Card fullscreen */}
    {fullscreenCard && (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={handleCloseCard}>
        <button
          onClick={(e) => { e.stopPropagation(); handleCloseCard(); }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700 z-10"
        >×</button>
        <img
          src={fullscreenCard}
          alt="Card"
          className="max-w-full max-h-full object-contain"
          onClick={e => e.stopPropagation()}
        />
      </div>
    )}
    </>
  );
}