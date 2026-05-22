// ⚠️ NUNCA EDITE lib/elton/system.ts VIA ESTE AGENTE. Prompt gerenciado manualmente.
"use client";
import { useState, useRef, useEffect } from "react";

// --- TIPOS ---
interface Message {
  id: string;
  role: "user" | "elton" | "system";
  content: string;
  timestamp: number;
  image?: string;
}

// --- COMPONENTE PRINCIPAL ---
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
  const [isRecording, setIsRecording] = useState(false);
  const [cardModal, setCardModal] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
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
          // "elton" → "assistant" para compatibilidade com a API do Claude
          history: messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              role: m.role === "elton" ? "assistant" : "user",
              content: m.content,
            })),
        }),
      });

      const data = await response.json();

      if (data.message && data.message.includes("Card:")) {
        const cardName = data.message.match(/Card:\s*([^\n]+)/)?.[1] || "Clube K-RRO";
        setCardModal(cardName);

        const systemMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: `📎 Card: ${cardName}`,
          image: `/cards/${cardName.toLowerCase().replace(/ /g, "-")}.png`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, systemMsg]);
      } else {
        const eltonMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "elton",
          content: data.message || "Erro ao processar.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, eltonMsg]);
      }
    } catch (error) {
      console.error("Erro:", error);
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "elton",
        content: "Problema na conexão. Tente novamente.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LÓGICA DE ÁUDIO ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: "audio/webm" });
        setIsLoading(true);
        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.transcription) {
            await handleSendText(data.transcription);
          } else {
            alert("Não consegui entender o áudio.");
          }
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

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">

      {/* HEADER */}
      <div className="flex items-center p-4 border-b border-gray-800 bg-[#0a0a0a] z-10">
        <div className="flex flex-col">
          <h1 className="font-bold text-lg">Elton</h1>
          <span className="text-xs text-gray-400">Consultor K-RRO</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-xs text-green-500">online</span>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-blue-600 rounded-tr-none"
                : "bg-[#1a1a1a] border border-gray-800 rounded-tl-none"
            }`}>

              {msg.role === "system" && msg.image ? (
                <div className="mt-2" onClick={() => setCardModal(msg.content.replace("📎 Card: ", ""))}>
                  <div className="bg-gray-800 p-2 rounded-lg border border-gray-700 cursor-pointer hover:opacity-90 transition">
                    <p className="text-xs text-gray-400 mb-2">{msg.content}</p>
                    <div className="w-full h-48 bg-gray-900 flex items-center justify-center rounded">
                      <span className="text-4xl">🖼️</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              )}

              <span className="text-[10px] text-gray-500 block mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-2xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA (FIXO) */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a] p-3 pb-6 border-t border-gray-800">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendText(input)}
            placeholder="Digite sua mensagem..."
            disabled={isRecording || isLoading}
            className="flex-1 bg-[#1a1a1a] text-white rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-base"
          />

          <button
            onClick={() => handleSendText(input)}
            disabled={!input.trim() || isLoading || isRecording}
            className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 hover:bg-blue-500 transition"
          >
            ➤
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition transform ${
              isRecording
                ? "bg-red-600 animate-pulse scale-110"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {isLoading && !isRecording ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-xl">{isRecording ? "⏹️" : "🎤"}</span>
            )}
          </button>
        </div>
      </div>

      {/* MODAL CARD TELA CHEIA */}
      {cardModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <button
            onClick={() => setCardModal(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700 z-50"
          >
            ✕
          </button>
          <h2 className="text-xl font-bold mb-4">{cardModal}</h2>
          <div className="w-full max-w-lg h-[70vh] bg-gray-900 rounded-xl flex items-center justify-center border border-gray-800">
            <p className="text-gray-500">Imagem do Card: {cardModal}</p>
          </div>
        </div>
      )}

    </div>
  );
}
