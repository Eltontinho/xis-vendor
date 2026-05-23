"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "elton" | "system";
  content: string;
  timestamp: number;
  image?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "elton",
      content: "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 1) inputRef.current?.focus();
  }, []);

  const handleSendText = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    if (typeof window !== "undefined" && window.innerWidth < 768) {
      inputRef.current?.blur();
    }

    try {
      const response = await fetch("/api/elton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (data.message) {
        const eltonMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "elton",
          content: data.message,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, eltonMsg]);

        if (data.message.includes("Card:") || data.message.includes("Clube K-RRO")) {
          setTimeout(() => setShowCardModal(true), 500);
        }
      }
    } catch (error) {
      console.error("Erro:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "elton",
          content: "Problema na conexão. Tente novamente.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "user",
          content: "📷 Analise esta imagem:",
          timestamp: Date.now(),
          image: base64,
        },
      ]);

      sendToEltonWithImage("Analise esta imagem e me diga o que você vê.", base64);
    };
    reader.readAsDataURL(file);
  };

  const sendToEltonWithImage = async (text: string, base64Image: string) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/elton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          image: base64Image,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "elton",
            content: data.message,
            timestamp: Date.now(),
          },
        ]);

        if (data.message.includes("Card:") || data.message.includes("Clube K-RRO")) {
          setTimeout(() => setShowCardModal(true), 500);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
        <div>
          <h1 className="font-bold text-lg">Elton</h1>
          <p className="text-xs text-gray-400">Consultor K-RRO</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-xs text-green-500">online</span>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 rounded-tr-none"
                  : "bg-gray-800 rounded-tl-none"
              }`}
            >
              {msg.image && (
                <div className="mb-2">
                  <img
                    src={msg.image}
                    alt="Upload"
                    className="max-w-full rounded-lg max-h-48 object-cover"
                  />
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <span className="text-[10px] text-gray-400 block mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-3 pb-6 z-50">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-11 h-11 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 hover:bg-gray-600 transition"
          >
            📷
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendText(input)}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-white rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-base min-w-0"
          />

          <button
            onClick={() => handleSendText(input)}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 hover:bg-blue-500 transition"
          >
            ➤
          </button>
        </div>
      </div>

      {/* Modal Card */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setShowCardModal(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700"
          >
            ×
          </button>
          <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-center text-white">Clube K-RRO</h2>
            <div className="space-y-4 text-gray-300">
              <p>✅ Até 94% para o motorista</p>
              <p>✅ Pagamento diário via Pix</p>
              <p>✅ Suporte humano real</p>
              <p>✅ Motorista Favorito & Vai e Volta</p>
            </div>
            <button
              onClick={() => setShowCardModal(false)}
              className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-500"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
