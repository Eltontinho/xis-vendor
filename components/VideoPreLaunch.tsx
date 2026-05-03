"use client";

import { useState, useEffect } from "react";
import Chat from "./Chat";

export default function VideoPreLaunch() {
  const [reservedNumber, setReservedNumber] = useState<number | null>(null);

  // Busca número reservado em background — não bloqueia a abertura do chat
  useEffect(() => {
    fetch("/api/reserve/next-number")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.number === "number") setReservedNumber(d.number);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="w-full h-full">
      <Chat reservedNumber={reservedNumber ?? undefined} />
    </div>
  );
}
