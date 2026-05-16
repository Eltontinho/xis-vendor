"use client";

interface Props {
  onClose: () => void;
}

export default function CardEntrada({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.97)" }}
    >
      <div
        style={{
          backgroundColor: "#0a0a0f",
          border: "1px solid #0066ff",
          borderRadius: 16,
          padding: "32px 24px",
          maxWidth: 420,
          width: "100%",
          position: "relative",
          boxShadow: "0 0 40px rgba(0,102,255,0.3)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(0,102,255,0.15)",
            border: "1px solid #0066ff66",
            borderRadius: "50%",
            width: 32,
            height: 32,
            color: "#ffffff",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src="/logo-krro.png"
            alt="K-RRO"
            style={{
              height: 40,
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
              marginBottom: 16,
            }}
          />
          <h1
            style={{
              color: "#ffffff",
              fontSize: 26,
              fontWeight: 800,
              margin: 0,
              letterSpacing: 3,
            }}
          >
            K-RRO
          </h1>
          <p
            style={{
              color: "#0066ff",
              fontSize: 13,
              fontWeight: 600,
              margin: "4px 0 0",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            Mobilidade com Padrão
          </p>
        </div>

        <div
          style={{
            color: "#cccccc",
            fontSize: 14,
            lineHeight: 1.75,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p style={{ margin: 0 }}>
            Na K-RRO, você não é funcionário de ninguém. É um profissional autônomo tratado com o respeito que sempre mereceu.
          </p>
          <p style={{ margin: 0 }}>
            Aqui você não é só um número. É parte de um clube de motoristas que se valorizam e carregam o selo de fundador.
          </p>
          <p style={{ margin: 0 }}>
            A K-RRO é para quem cuida do carro, do atendimento e da postura. Um padrão profissional que é para poucos.
          </p>
          <p style={{ margin: 0, color: "#0066ff", fontWeight: 600 }}>
            Mobilidade com padrão.
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 24,
            width: "100%",
            backgroundColor: "#0066ff",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "13px 0",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          Quero conhecer
        </button>
      </div>
    </div>
  );
}
