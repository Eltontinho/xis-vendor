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
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "elton", content: data.message, timestamp: Date.now() }]);
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }
      if (data.card?.type) {
        const cardImg = data.card.type === "apresentacao" ? "/cards/cardk-rrobranco.png"
          : data.card.type === "clube" ? "/cards/clube-todos.png"
          : "/cards/clube-platina.jpg";
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
    <div className="flex flex-col h-screen bg-black">
      <div className="flex flex-col h-full w-full max-w-[430px] mx-auto bg-black relative text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
        <h1 className="font-bold">Elton</h1>
        <span className="text-xs text-green-500">● Online</span>
      </div>

      {/* Chat */}
      <div className="relative flex-1 overflow-y-auto bg-gray-900">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img src="/cards/cardk-rrofundopreto.png" alt="" className="w-3/5 select-none" style={{ opacity: 0.15 }} />
        </div>
        <div className="relative p-4 space-y-4 pb-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2 break-words ${m.role === "user" ? "bg-blue-600" : "bg-gray-800"}`}>
              {m.image && <img src={m.image} alt="upload" className="max-w-full rounded-lg mb-2 max-h-60 object-contain" />}
              {m.cardType && <img src={m.cardType} onClick={() => setFullscreenCard(m.cardType!)} className="rounded-xl max-w-[200px] cursor-pointer" />}
              {m.content && <p>{m.content}</p>}
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
      <div className="w-full bg-gray-900 p-4 border-t border-gray-800 flex gap-2 items-center">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
        <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 disabled:opacity-50">
          📷
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendText()}
          placeholder="Digite ou envie foto..."
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 outline-none"
          disabled={isLoading}
        />
        <button onClick={handleSendText} disabled={isLoading || !input.trim()} className="bg-blue-600 px-4 py-2 rounded-lg font-bold disabled:opacity-50">
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
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
        <button onClick={() => setFullscreenCard(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700 z-10">×</button>
        <img src={fullscreenCard} alt="Card" className="max-w-sm w-full rounded-2xl" />
      </div>
    )}
    </>
  );
}
