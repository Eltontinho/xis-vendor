"use client";

import { ChatMessage } from "@/lib/types";

interface Props {
  message: ChatMessage;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Divide o texto em partes de texto puro e URLs, renderiza URLs como botões.
function renderContent(text: string) {
  const parts = text.split(/(https?:\/\/\S+)/g);

  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white text-[14px] font-semibold rounded-xl shadow-sm no-underline"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
            Acessar link de pagamento
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function ChatBubble({ message }: Props) {
  const isAxis = message.role === "axis";

  return (
    <div
      className={`flex items-end gap-2 mb-2 px-4 ${
        isAxis ? "justify-start" : "justify-end"
      }`}
    >
      <div
        className={`relative max-w-[75%] px-3 py-2 shadow-sm text-[15px] leading-snug ${
          isAxis
            ? "bg-white rounded-2xl rounded-bl-none text-gray-800"
            : "bg-[#dcf8c6] rounded-2xl rounded-br-none text-gray-800"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {renderContent(message.content)}
        </p>
        <span className="block text-right text-[11px] text-gray-400 mt-1">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
