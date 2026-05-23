"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "elton";
  content: string;
  timestamp: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "elton", content: "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?", timestamp: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input;
    setInput("");
    setIsLoading(true);

    const newMsgs = [...messages, { id: Date.now().toString(), role: "user" as const, content: userText, timestamp: Date.now() }];
    setMessages(newMsgs);

    try {
      const res = await fetch("/api/elton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history: newMsgs }),
      });

      const data = await res.json();

      if (data.message) {
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "elton", content: data.message, timestamp: Date.now() }]);
      } else {
        throw new Error("Sem resposta");
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "elton", content: "Erro de conexão. Verifique se as chaves API estão corretas no Vercel.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <div className="p-4 border-b border-gray-800 bg-gray-900"><h1 className="font-bold">Elton</h1></div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2 ${m.role === "user" ? "bg-blue-600" : "bg-gray-800"}`}>
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="fixed bottom-0 w-full bg-gray-900 p-4 border-t border-gray-800 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Digite..."
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 outline-none"
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading} className="bg-blue-600 px-6 rounded-lg font-bold disabled:opacity-50">
          Enviar
        </button>
      </div>
    </div>
  );
}
