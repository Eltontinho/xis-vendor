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

function CardApresentacao({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg z-10">×</button>
      <img src="/cardk-rrofundopreto.png" className="w-full max-w-sm rounded-2xl" />
    </div>
  );
}

function CardClube({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative">
      <button onClick={onClose} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center text-lg z-10">×</button>
      <img src="/clube-todos.png" className="w-full max-w-sm rounded-2xl" />
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "elton", content: "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [splashOpen, setSplashOpen] = useState(true);
  const [fullscreenCard, setFullscreenCard] = useState<string | null>(null);
  const [cardsShown, setCardsShown] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const handleSendText = async () => {
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    // Adiciona a msg do usuário no chat antes de enviar
    setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", content: text, timestamp: Date.now() }]);
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

  const typeMessage = (msgText: string, msgId: string): Promise<void> => {
    return new Promise((resolve) => {
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: msgText.slice(0, i) } : m));
        if (i >= msgText.length) { clearInterval(iv); resolve(); }
      }, 20);
    });
  };

  const displayEltonResponse = async (fullMessage: string) => {
    const fragments = fullMessage
      .replace(/([.!?])\s+/g, "$1\n")
      .split("\n")
      .map(f => f.trim())
      .filter(f => f.length > 0);

    for (let i = 0; i < fragments.length; i++) {
      if (i > 0) {
        setMessages(prev => [...prev, { id: "typing-indicator", role: "elton", content: "__typing__", timestamp: Date.now() }]);
        await new Promise(r => setTimeout(r, 1500));
        setMessages(prev => prev.filter(m => m.id !== "typing-indicator"));
      }
      const msgId = `elton-${Date.now()}-${i}`;
      setMessages(prev => [...prev, { id: msgId, role: "elton", content: "", timestamp: Date.now() }]);
      await typeMessage(fragments[i], msgId);
      if (i < fragments.length - 1) await new Promise(r => setTimeout(r, 800));
    }
  };

  const handleCloseCard = async () => {
    const card = fullscreenCard;
    setFullscreenCard(null);
    await new Promise(r => setTimeout(r, 800));
    const question = card === "/cards/cardk-rrofundopreto.png"
      ? "O que te chamou atenção no card?"
      : card === "/cards/clube-todos.png"
      ? "Qual desses benefícios faz mais sentido pra você hoje?"
      : "O que achou do que viu?";
    await displayEltonResponse(question);
  };

  const sendMessageToElton = async (text: string, base64Image?: string) => {
    setIsLoading(true);

    const historyPayload = messages.map(m => ({
      role: m.role === "elton" ? "assistant" : "user",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/elton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, image: base64Image, history: historyPayload }),
      });

      const data = await res.json();

      if (data.message) {
        await displayEltonResponse(data.message);
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }
      if (data.card?.type && !cardsShown.has(data.card.type)) {
        setCardsShown(prev => new Set(prev).add(data.card.type));
        const cardImg = data.card.type === "apresentacao" ? "/cards/cardk-rrofundopreto.png"
          : data.card.type === "clube" ? "/cards/clube-todos.png"
          : "/cards/clube-platina.jpg";
        await new Promise(r => setTimeout(r, 2000));
        setMessages(prev => [...prev, { id: (Date.now() + 2).toString(), role: "elton", content: "", timestamp: Date.now(), cardType: cardImg }]);
        setFullscreenCard(cardImg);
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
      <div className="flex flex-col h-full w-full max-w-[430px] mx-auto w-full bg-black relative text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/elton-avatar.png" alt="Elton" className="w-10 h-10 rounded-full object-cover" />
          <div>
            <h1 className="font-bold text-white">Elton</h1>
            <p className="text-xs text-gray-400">Consultor K-RRO</p>
          </div>
        </div>
        <span className="text-xs text-green-500">● Online</span>
      </div>

      {/* Chat */}
      <div className="relative flex-1 overflow-y-auto bg-[#0a0f1e]">
        {/* Logo centralizado dentro da coluna do chat */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <img src="/logo-krro.png" alt="" className="w-3/4 select-none" style={{ opacity: 0.35 }} />
        </div>
        <div className="relative p-4 space-y-4 pb-4 z-10">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-4 py-2 break-words text-sm ${
              m.role === "user"
                ? "bg-blue-600 rounded-2xl rounded-tr-sm text-white"
                : "bg-gray-900 border-l-[3px] border-blue-500 rounded-r-2xl text-gray-200"
            }`}>
              {m.image && <img src={m.image} alt="upload" className="max-w-full rounded-lg mb-2 max-h-60 object-contain" />}
              {m.cardType && <img src={m.cardType} onClick={() => setFullscreenCard(m.cardType!)} className="rounded-xl max-w-[200px] cursor-pointer" />}
              {m.content === "__typing__" ? (
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              ) : m.content ? <p>{m.content}</p> : null}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-xl px-4 py-3 flex gap-1">
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="w-full bg-gray-900 px-4 py-3 border-t border-gray-800 flex gap-2 items-center overflow-visible">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 disabled:opacity-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendText()}
          placeholder="Digite ou envie foto..."
          className="flex-1 min-w-0 bg-gray-800 rounded-lg px-4 py-2 outline-none"
          disabled={isLoading}
        />
        <button onClick={handleSendText} disabled={isLoading || !input.trim()} className="bg-blue-600 px-4 py-2 rounded-lg font-bold disabled:opacity-50 shrink-0 min-w-[44px]">
          ➤
        </button>
      </div>
      </div>
    </div>

    {/* Splash inicial */}
    {splashOpen && (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <button onClick={() => setSplashOpen(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700 z-10">×</button>
        <img src="/cards/krro-apresentacao.png" alt="K-RRO" className="w-full h-full object-contain" />
      </div>
    )}

    {/* Card fullscreen */}
    {fullscreenCard && (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={handleCloseCard}>
        <button onClick={handleCloseCard} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700 z-10">×</button>
        <img src={fullscreenCard} alt="Card" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}
