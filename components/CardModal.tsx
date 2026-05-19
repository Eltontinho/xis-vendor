"use client";

interface Props {
  src: string;
  onClose: () => void;
}

function cardLabel(src: string): string {
  if (src.includes("cardk-rrobranco")) return "Clube K-RRO";
  if (src.includes("clube-platina")) return "Plano Platina";
  if (src.includes("clube-ouro")) return "Plano Ouro";
  if (src.includes("clube-prata")) return "Plano Prata";
  if (src.includes("clube-todos")) return "Planos disponíveis";
  if (src.includes("krro-apresentacao")) return "Apresentação K-RRO";
  return "K-RRO";
}

export default function CardModal({ src, onClose }: Props) {
  const label = cardLabel(src);
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.95)", zIndex: 9999 }}
      onClick={onClose}
    >
      <p
        style={{ color: "#aaa", fontSize: 12, marginBottom: 10, letterSpacing: 1, textTransform: "uppercase" }}
        onClick={(e) => e.stopPropagation()}
      >
        📎 {label}
      </p>
      <img
        src={src}
        alt={label}
        className="object-contain rounded-xl shadow-2xl"
        style={{ maxWidth: "92vw", maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center rounded-full text-white font-light"
        style={{ width: 44, height: 44, background: "rgba(255,255,255,0.15)", fontSize: 20 }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
}
