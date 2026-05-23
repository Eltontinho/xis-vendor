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
  const [showCardModal, setShowCardModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 1) {
      inputRef.current?.focus();
    }
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
          // elton → assistant: obrigatório para a API do Claude não rejeitar com 400
          history: messages
            .filter((m) => m.role !== "system")
            .map((m) => ({
              role: m.role === "elton" ? "assistant" : "user",
              content: m.content,
            })),
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

        if (
          data.message.includes("Card:") ||
          data.message.includes("card") ||
          data.message.includes("Clube K-RRO")
        ) {
          setTimeout(() => setShowCardModal(true), 500);
        }
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setIsLoading(true);
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
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
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "user",
            content: "📷 Foto enviada",
            timestamp: Date.now(),
            image: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
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
          {/* Camera Button */}
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
            aria-label="Enviar foto"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendText(input)}
            placeholder="Digite sua mensagem..."
            disabled={isLoading || isRecording}
            className="flex-1 bg-gray-800 text-white rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-base min-w-0"
          />

          {/* Send Button */}
          <button
            onClick={() => handleSendText(input)}
            disabled={!input.trim() || isLoading || isRecording}
            className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 hover:bg-blue-500 transition"
            aria-label="Enviar mensagem"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>

          {/* Mic Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
            aria-label={isRecording ? "Parar gravação" : "Gravar áudio"}
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition disabled:opacity-50 ${
              isRecording ? "bg-red-600 animate-pulse" : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Card Modal */}
      {showCardModal && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <button
            onClick={() => setShowCardModal(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-800 text-white text-2xl flex items-center justify-center hover:bg-gray-700"
          >
            ×
          </button>
          <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full">
            <h2 className="text-xl font-bold mb-4 text-center">Clube K-RRO</h2>
            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">🚗</div>
                <div>
                  <p className="font-semibold">Categorias</p>
                  <p className="text-sm text-gray-400">GO • PLUS • SUV • EXEC • CARE</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">⭐</div>
                <div>
                  <p className="font-semibold">Funcionalidades</p>
                  <p className="text-sm text-gray-400">Corrida Avulsa • Vai e Volta • Motorista Favorito</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">💰</div>
                <div>
                  <p className="font-semibold">Pagamento</p>
                  <p className="text-sm text-gray-400">Diário via Pix • Todo dia às 6h</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">📊</div>
                <div>
                  <p className="font-semibold">Taxas</p>
                  <p className="text-sm text-gray-400">Clube K-RRO: até 94% para o motorista</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
