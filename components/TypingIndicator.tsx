"use client";

import AgentAvatar from "./AgentAvatar";

export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-2 px-4">
      <AgentAvatar size="sm" />
      <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-sm max-w-[80px]">
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-[dot-bounce_1.2s_infinite]"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-[dot-bounce_1.2s_infinite]"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-gray-400 animate-[dot-bounce_1.2s_infinite]"
            style={{ animationDelay: "400ms" }}
          />
        </div>
      </div>
    </div>
  );
}
