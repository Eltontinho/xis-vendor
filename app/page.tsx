"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "elton";
  content: string;
}

function getOrCreateSessionId(): string {
  const KEY = "elton_session_id";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

const SECRET = process.env.NEXT_PUBLIC_ELTON_CLIENT_SECRET ?? "";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "elton", content: "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?" },
  ]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [stage, setStage]           = useState("novo");
  const [vagas, setVagas]           = useState<number | null>(null);

  const bottomRef        = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    fetch("/api/elton/vagas", { headers: { "x-elton-secret": SECRET } })
      .then(r => r.json())
      .then(d => { if (typeof d.vagas === "number") setVagas(d.vagas); })
      .catch(() => {});
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const sessionId      = getOrCreateSessionId();
      const confirmedPhone = sessionStorage.getItem("elton_confirmed_phone");

      const res  = await fetch("/api/elton", {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-elton-secret": SECRET },
        body:    JSON.stringify({ message: text, session_id: sessionId, confirmed_phone: confirmedPhone }),
      });

      const data = await res.json();

      if (data.phone_extracted) sessionStorage.setItem("elton_confirmed_phone", data.phone_extracted);
      if (data.stage)           setStage(data.stage);
      if (typeof data.vagas === "number") setVagas(data.vagas);

      setMessages(prev => [...prev, { role: "elton", content: data.message ?? "..." }]);
    } catch {
      setMessages(prev => [...prev, { role: "elton", content: "Problema técnico. Tente novamente." }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [loading]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "audio.webm");
        try {
          const r    = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await r.json();
          if (data.transcription) sendMessage(data.transcription);
        } catch {}
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {}
  }, [isRecording, sendMessage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0d0d0d", color: "#e0e0e0", fontFamily: "'Courier New', monospace" }}>

      {/* ── Header ── */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#00e676", fontWeight: "bold", fontSize: "13px", letterSpacing: "1px" }}>ELTON · K-RRO</span>
        <span style={{ fontSize: "11px", color: "#555" }}>
          {vagas !== null ? `${vagas} vagas` : "—"} · {stage}
        </span>
      </div>

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth:     "82%",
              padding:      "10px 14px",
              borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
              background:   m.role === "user" ? "#1a2035" : "#161616",
              border:       `1px solid ${m.role === "user" ? "#2a3050" : "#222"}`,
              fontSize:     "14px",
              lineHeight:   "1.55",
              whiteSpace:   "pre-wrap",
              wordBreak:    "break-word",
            }}>
              {m.role === "elton" && (
                <span style={{ color: "#00e676", fontSize: "10px", display: "block", marginBottom: "5px", letterSpacing: "1px" }}>
                  ELTON
                </span>
              )}
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "10px 14px", borderRadius: "3px 14px 14px 14px", background: "#161616", border: "1px solid #222", fontSize: "14px" }}>
              <span style={{ color: "#00e676", fontSize: "10px", display: "block", marginBottom: "5px", letterSpacing: "1px" }}>ELTON</span>
              <span style={{ color: "#444" }}>▋</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <div style={{ padding: "10px 12px", borderTop: "1px solid #1e1e1e", display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder="mensagem..."
          disabled={loading}
          style={{
            flex:        1,
            background:  "#111",
            border:      "1px solid #2a2a2a",
            borderRadius: "8px",
            padding:     "10px 14px",
            color:       "#e0e0e0",
            fontSize:    "14px",
            fontFamily:  "inherit",
            outline:     "none",
          }}
        />
        <button
          onClick={toggleRecording}
          title={isRecording ? "Parar gravação" : "Gravar áudio"}
          style={{
            width:        "42px",
            height:       "42px",
            borderRadius: "8px",
            border:       `1px solid ${isRecording ? "#550000" : "#2a2a2a"}`,
            background:   isRecording ? "#1a0000" : "#111",
            color:        isRecording ? "#ff4444" : "#666",
            cursor:       "pointer",
            fontSize:     "17px",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
          }}
        >
          {isRecording ? "⏹" : "🎙"}
        </button>
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            width:        "42px",
            height:       "42px",
            borderRadius: "8px",
            border:       "1px solid #2a2a2a",
            background:   input.trim() && !loading ? "#003d1a" : "#111",
            color:        input.trim() && !loading ? "#00e676" : "#333",
            cursor:       input.trim() && !loading ? "pointer" : "default",
            fontSize:     "18px",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
