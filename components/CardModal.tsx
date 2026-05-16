"use client";

interface Props {
  src: string;
  onClose: () => void;
}

export default function CardModal({ src, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
      onClick={onClose}
    >
      <img
        src={src}
        alt=""
        className="object-contain"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full text-white text-lg font-light"
        style={{ backgroundColor: "rgba(0,102,255,0.7)" }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
}
