"use client";

import { useState } from "react";

interface Props {
  /** "sm" = 32px (balões), "md" = 40px (cabeçalho) */
  size?: "sm" | "md";
}

export default function AgentAvatar({ size = "md" }: Props) {
  const [failed, setFailed] = useState(false);

  const dim =
    size === "sm"
      ? "w-8 h-8 text-[11px]"
      : "w-10 h-10 text-sm";

  return (
    <div
      className={`${dim} rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 text-white font-bold overflow-hidden`}
    >
      {!failed ? (
        <img
          src="/avatar.jpg"
          alt="Elton"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>EL</span>
      )}
    </div>
  );
}
