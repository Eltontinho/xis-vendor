import VideoPreLaunch from "@/components/VideoPreLaunch";

export const metadata = {
  title: "K-RRO — Pré-lançamento",
  description: "Seja parceiro K-RRO. Transforme sua frota.",
};

export default function PreLancamento() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#0f0f1a] sm:flex sm:items-center sm:justify-center">
      {/* Mobile: tela cheia. Desktop: phone centralizado com sombra */}
      <div className="relative w-full h-full sm:max-w-[420px] sm:h-screen sm:shadow-[0_0_80px_rgba(0,0,0,0.85)] overflow-hidden">
        <VideoPreLaunch />
      </div>
    </main>
  );
}
