"use client";

interface Props {
  src: string;
  onClose: () => void;
}

export default function CardModal({ src, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.95)", zIndex: 9999 }}
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
        className="absolute top-4 right-4 flex items-center justify-center rounded-full text-white font-light"
        style={{ width: 44, height: 44, background: "rgba(255,255,255,0.15)", fontSize: 20 }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
}
