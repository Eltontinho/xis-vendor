"use client";

import { useState, useEffect } from "react";

interface Props {
  onContinue: (number: number) => void;
}

const TOTAL_SECONDS = 15 * 60;

function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function LuckyNumber({ onContinue }: Props) {
  const [number, setNumber] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);

  // Busca o próximo número disponível
  useEffect(() => {
    fetch("/api/reserve/next-number")
      .then((r) => r.json())
      .then((d) => setNumber(d.number as number))
      .catch(() => setNumber(Math.floor(Math.random() * 90) + 10));
  }, []);

  // Inicia contagem regressiva assim que o número chegar
  useEffect(() => {
    if (number === null) return;
    const id = setInterval(
      () => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)),
      1000
    );
    return () => clearInterval(id);
  }, [number]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0f0f1a] px-6 text-center">
      {number === null ? (
        /* Spinner enquanto carrega */
        <div className="w-9 h-9 border-[3px] border-[#7c7cff] border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed max-w-[260px]">
            Elton reservou um número especial para você
          </p>

          <div
            className="font-bold text-[#7c7cff] leading-none mb-3 tabular-nums"
            style={{ fontSize: "clamp(72px, 20vw, 96px)" }}
          >
            #{number}
          </div>

          <p className="text-gray-500 text-sm mb-10">
            Reservado por{" "}
            <span className="text-white font-semibold tabular-nums">
              {fmtTime(secondsLeft)}
            </span>
          </p>

          <button
            onClick={() => onContinue(number)}
            className="w-full max-w-[280px] py-4 rounded-2xl font-bold text-[15px] tracking-widest text-white shadow-lg active:scale-95 transition-transform"
            style={{ background: "#7c7cff" }}
          >
            FALAR COM ELTON
          </button>
        </>
      )}
    </div>
  );
}
