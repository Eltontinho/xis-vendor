"use client";

import { useState, useRef, useEffect } from "react";
import CardModal from "@/components/CardModal";

type Message = {
  id: string;
  role: "user" | "elton";
  text?: string;
  image?: string;
  audioUrl?: string;
  timestamp: number;
};

type FlowStep =
  | "nome" | "card" | "pergunta" | "cidade" | "carro" | "ano"
  | "corridas" | "ticket" | "conta" | "clube" | "plano" | "form";

const PLAN_META = {
  platina: { label: "Platina", valor: "R$397/ano", lot: "lote3" },
  ouro:    { label: "Ouro",    valor: "R$347/ano", lot: "lote2" },
  prata:   { label: "Prata",   valor: "R$297/ano", lot: "lote1" },
} as const;
type PlanKey = keyof typeof PLAN_META;

type FormData = { nome: string; telefone: string; email: string; placa: string; cidade: string };
type DataCollection = { step: number; formData: Partial<FormData>; active: boolean; userName?: string; userCity?: string } | null;

const COLETA_PERGUNTAS = [
  "Qual é o seu nome completo?",
  "Qual é o seu WhatsApp com DDD? (Ex: 51 99999-8888)",
  "Qual é o seu e-mail?",
  "Qual é a placa do seu veículo? (Ex: ABC1D23)",
  "Em qual cidade você trabalha?",
];

function checkFormTrigger(message: string): boolean {
  const lower = message.toLowerCase();
  const hasPlan = message.includes("Platina") || message.includes("Ouro") || message.includes("Prata");
  if (!hasPlan) return false;
  return (
    lower.includes("formulário") ||
    lower.includes("preencher") ||
    lower.includes("cadastro") ||
    lower.includes("link") ||
    lower.includes("dados") ||
    lower.includes("membro") ||
    lower.includes("para garantir") ||
    lower.includes("garantir sua vaga")
  );
}

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

function generateId() { return Math.random().toString(36).slice(2, 9); }

function getSessionId() {
  if (typeof window === "undefined") return `ssr_${Date.now()}`;
  const key = "elton_session";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function extractNumber(text: string): number | null {
  const clean = text.replace(/[Rr]\$\s*/g, "").replace(",", ".");
  const match = clean.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function fmtBR(n: number): string { return Math.round(n).toLocaleString("pt-BR"); }

function cardLabel(src: string): string {
  if (src.includes("cardk-rrobranco")) return "Clube K-RRO";
  if (src.includes("clube-platina")) return "Plano Platina";
  if (src.includes("clube-ouro")) return "Plano Ouro";
  if (src.includes("clube-prata")) return "Plano Prata";
  if (src.includes("clube-todos")) return "Planos disponíveis";
  if (src.includes("krro-apresentacao")) return "Apresentação K-RRO";
  return "K-RRO";
}

export default function EltonChat() {
  // ─── State ───────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [vagas, setVagas] = useState(42);
  const [isRecording, setIsRecording] = useState(false);
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [showEntrada, setShowEntrada] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<typeof PLAN_META[PlanKey]>(PLAN_META.platina);
  const [membroNumero, setMembroNumero] = useState<string | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("nome");
  const [pendingFallback, setPendingFallback] = useState<{
    checkout_url: string; lotUsado: string;
    planoFallback: typeof PLAN_META[PlanKey]; mensagem: string;
  } | null>(null);
  const [dataCollection, setDataCollection] = useState<DataCollection>(null);
  const [showCollectionButton, setShowCollectionButton] = useState(false);

  const [sessionId] = useState<string>(() =>
    typeof window !== "undefined" ? getSessionId() : `ssr_${Date.now()}`
  );

  // ─── Refs ────────────────────────────────────────────────────────────────
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const apiCallCountRef = useRef(0);
  const cardKRROSentRef = useRef(false);
  const clubeCardSent = useRef(false);
  const planCardSent = useRef(false);
  const flowStepRef = useRef<FlowStep>("nome");
  const corridasRef = useRef<number | null>(null);
  const ticketRef = useRef<number | null>(null);
  const esgotadoShownRef = useRef(false);
  const userConfirmedPlanRef = useRef(false);
  const dataStartedRef = useRef(false);
  const cityFromEarlierRef = useRef<string | null>(null);

  useEffect(() => { flowStepRef.current = flowStep; }, [flowStep]);

  // ─── Timer helpers ───────────────────────────────────────────────────────
  function scheduleTimer(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(fn, delay);
    pendingTimersRef.current.push(id);
    return id;
  }

  function clearAllTimers() {
    pendingTimersRef.current.forEach(clearTimeout);
    pendingTimersRef.current = [];
    if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }
  }

  // ─── Effects ─────────────────────────────────────────────────────────────

  async function getPlanoDisponivel(): Promise<typeof PLAN_META[PlanKey] | null> {
    try {
      const res = await fetch("/api/planos-disponiveis");
      const data = await res.json();
      if (!data.planoAtivo || data.vagasRestantes === 0) return null;
      const map: Record<string, typeof PLAN_META[PlanKey]> = {
        platina: PLAN_META.platina, ouro: PLAN_META.ouro, prata: PLAN_META.prata,
      };
      return map[data.planoAtivo] ?? null;
    } catch { return PLAN_META.platina; }
  }

  useEffect(() => {
    fetch("/api/elton/vagas").then(r => r.json()).then(d => setVagas(d.vagas ?? 0)).catch(() => {});
    getPlanoDisponivel().then(p => { if (p) setSelectedPlan(p); });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showEntrada) handleEntradaClose();
      else if (modalSrc) setModalSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEntrada, modalSrc]);

  useEffect(() => { return () => clearAllTimers(); }, []);

  // ─── Typing animation ────────────────────────────────────────────────────
  function typeMessage(id: string, fullText: string, timestamp: number): Promise<void> {
    return new Promise(resolve => {
      if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }
      setTypingMessageId(id);
      setMessages(prev => [...prev, { id, role: "elton" as const, text: "", timestamp }]);
      if (!fullText) { setTypingMessageId(null); resolve(); return; }
      let i = 0;
      typingIntervalRef.current = setInterval(() => {
        i++;
        const current = fullText.slice(0, i);
        const done = i >= fullText.length;
        setMessages(prev => prev.map(m => m.id === id ? { ...m, text: current } : m));
        if (done) {
          clearInterval(typingIntervalRef.current!);
          typingIntervalRef.current = null;
          setTypingMessageId(null);
          resolve();
        }
      }, 18);
    });
  }

  function addImageCard(src: string) {
    setMessages(prev => [...prev, { id: generateId(), role: "elton" as const, image: src, timestamp: Date.now() }]);
  }

  // ─── Entry modal ─────────────────────────────────────────────────────────
  function handleEntradaClose() {
    localStorage.setItem("krro_entrada_visto", "true");
    setShowEntrada(false);
    scheduleTimer(() => {
      typeMessage(generateId(), "Seja bem-vindo à K-RRO! Sou o Elton. Qual é o seu nome?", Date.now());
    }, 300);
  }

  async function fetchNextNumber(lot: string) {
    try {
      const res = await fetch(`/api/reserve/next-number?lot=${lot}`);
      const data = await res.json();
      const num = data.number ?? Math.floor(Math.random() * 90) + 10;
      const suffix = lot === "lote3" ? "PL" : lot === "lote2" ? "OU" : "PR";
      setMembroNumero(`${String(num).padStart(3, "0")}${suffix}`);
    } catch { /* ignore */ }
  }

  // ─── Reserve API ─────────────────────────────────────────────────────────
  async function doReserve(dados: FormData) {
    setLoading(true);
    try {
      const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot: selectedPlan.lot,
          conversation_id: sessionId,
          driver_phone: dados.telefone.replace(/\D/g, ""),
          driver_name: dados.nome,
          driver_city: dados.cidade,
        }),
      });
      const data = await res.json();
      console.log("[RESERVE]", data);

      if (data.success === true && data.checkout_url) {
        setShowCollectionButton(false);
        if (data.lotUsado && data.lotUsado !== selectedPlan.lot) {
          const fb: typeof PLAN_META[PlanKey] =
            data.lotUsado === "lote3" ? PLAN_META.platina
            : data.lotUsado === "lote2" ? PLAN_META.ouro : PLAN_META.prata;
          const pct = data.lotUsado === "lote3" ? "94%" : data.lotUsado === "lote2" ? "92%" : "90%";
          setPendingFallback({ checkout_url: data.checkout_url, lotUsado: data.lotUsado, planoFallback: fb, mensagem: data.mensagem ?? "" });
          typeMessage(generateId(),
            `O plano ${selectedPlan.label} esgotou. Aloquei sua vaga no ${fb.label} com ${pct}. O valor é ${fb.valor}. Quer prosseguir?`,
            Date.now());
        } else {
          typeMessage(generateId(),
            `Aqui está seu link de pagamento:\n${data.checkout_url}\n\nVálido por 15 minutos. Qualquer dúvida é só chamar.`,
            Date.now());
        }
      } else if (data.error === "Lote esgotado") {
        esgotadoShownRef.current = true;
        typeMessage(generateId(),
          "As vagas para este plano esgotaram na sua região. Posso te colocar na lista de espera — quer continuar?",
          Date.now());
      } else {
        const errMsg = data.error || "Falha ao gerar link. Tente novamente ou digite /reset.";
        typeMessage(generateId(), `Erro ao processar: ${errMsg}`, Date.now());
      }
    } catch (err) {
      console.error("[RESERVE]", err);
      typeMessage(generateId(), "Erro de conexão ao gerar o link. Tente novamente.", Date.now());
    } finally {
      setLoading(false);
    }
  }

  // ─── Inicia coleta de dados via chat ─────────────────────────────────────
  function startDataCollection(plan: typeof PLAN_META[PlanKey]) {
    if (dataStartedRef.current) return;
    dataStartedRef.current = true;
    userConfirmedPlanRef.current = true;
    setSelectedPlan(plan);
    fetchNextNumber(plan.lot);
    setFlowStep("form");
    setShowCollectionButton(false);
    const initialData: Partial<FormData> = {};
    if (cityFromEarlierRef.current) initialData.cidade = cityFromEarlierRef.current;
    setDataCollection({ step: 0, formData: initialData, active: true });
    scheduleTimer(() => {
      typeMessage(generateId(), COLETA_PERGUNTAS[0], Date.now());
    }, 400);
  }

  // ─── Conta automática ────────────────────────────────────────────────────
  function computeContaMsgs(): [string, string, string] {
    const corridas = corridasRef.current ?? 20;
    const ticket = ticketRef.current ?? 18;
    const total = corridas * ticket;
    const bruto = total / 0.75;
    const diferenca = bruto - total;
    const m1 = `${corridas} corridas × R$${ticket.toFixed(0)} = R$${fmtBR(total)} que você recebeu. O passageiro pagou no mínimo R$${fmtBR(bruto)}. A plataforma ficou com R$${fmtBR(diferenca)}.`;
    const m2 = `Rodando 5 dias por semana, só de taxa você deixa R$${fmtBR(diferenca * 5)} por semana na plataforma. São R$${fmtBR(diferenca * 20)} por mês. R$${fmtBR(diferenca * 240)} por ano. Com esse valor dá pra andar de carro zero todo ano.`;
    const m3 = "Vou te mostrar o Clube K-RRO — quero que você esteja sempre de carro zero.";
    return [m1, m2, m3];
  }

  async function dispararConta() {
    const [m1, m2, m3] = computeContaMsgs();
    await typeMessage(generateId(), m1, Date.now());
    await new Promise<void>(r => scheduleTimer(() => r(), 1400));
    await typeMessage(generateId(), m2, Date.now());
    await new Promise<void>(r => scheduleTimer(() => r(), 1400));
    await typeMessage(generateId(), m3, Date.now());
    await new Promise<void>(r => scheduleTimer(() => r(), 900));
    if (!clubeCardSent.current) {
      clubeCardSent.current = true;
      addImageCard("/cards/clube-todos.png");
    }
    setFlowStep("clube");
    scheduleTimer(() => { setFlowStep("plano"); }, 1100);
  }

  // ─── Send text ───────────────────────────────────────────────────────────
  async function sendText(text: string) {
    if (!text.trim() || loading || typingMessageId !== null) return;

    // /reset
    if (text.trim() === "/reset") {
      clearAllTimers();
      localStorage.clear();
      localStorage.setItem("elton_reset", "true");
      clubeCardSent.current = false;
      planCardSent.current = false;
      cardKRROSentRef.current = false;
      corridasRef.current = null;
      ticketRef.current = null;
      esgotadoShownRef.current = false;
      userConfirmedPlanRef.current = false;
      dataStartedRef.current = false;
      cityFromEarlierRef.current = null;
      setDataCollection(null);
      setShowCollectionButton(false);
      setMessages([]);
      setModalSrc(null);
      setPendingFallback(null);
      window.location.reload();
      return;
    }

    // Confirmação de fallback de lote
    if (pendingFallback !== null) {
      const sim = /\b(sim|s|pode|prosseguir|quero|topo|ok|claro|confirmo)\b/i.test(text.trim());
      const nao = /\b(não|nao|n|cancela|desiste|cancel)\b/i.test(text.trim());
      const userMsg: Message = { id: generateId(), role: "user", text: text.trim(), timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      if (sim) {
        const { checkout_url, planoFallback } = pendingFallback;
        setPendingFallback(null);
        setSelectedPlan(planoFallback);
        typeMessage(generateId(), `Perfeito! Aqui está seu link:\n${checkout_url}\n\nVálido por 15 minutos. Qualquer dúvida é só chamar.`, Date.now());
        return;
      }
      if (nao) {
        setPendingFallback(null);
        typeMessage(generateId(), "Sem problema. Se mudar de ideia, é só me chamar.", Date.now());
        return;
      }
      typeMessage(generateId(), `Quer prosseguir com o ${pendingFallback.planoFallback.label} (${pendingFallback.planoFallback.valor})?`, Date.now());
      return;
    }

    // ─── Coleta de dados inline ───────────────────────────────────────────
    if (dataCollection !== null && dataCollection.active) {
      const userMsg: Message = { id: generateId(), role: "user", text: text.trim(), timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setInput("");

      // Lógica de rejeição
      const isRejection = /\b(não quero|nao quero|não vou pagar|nao vou pagar)\b/i.test(text.trim());
      if (isRejection) {
        setDataCollection(prev => prev ? { ...prev, active: false } : null);
        setShowCollectionButton(false);
        typeMessage(generateId(), "Tudo bem! Se mudar de ideia, é só me chamar. Estarei aqui.", Date.now());
        return;
      }

      const { step, formData } = dataCollection;
      const newData = { ...formData };

      // Confirmação final (step 5)
      if (step === 5) {
        const sim = /\b(sim|s\b|pode|correto|certo|ok\b|claro|confirmo|tá|ta\b|tudo certo)\b/i.test(text.trim());
        const nao = /\b(não|nao|n\b|cancela|errado|incorreto|corrigir|recomeçar|muda)\b/i.test(text.trim());
        if (sim) {
          setDataCollection(null);
          await doReserve(newData as FormData);
          return;
        }
        if (nao) {
          dataStartedRef.current = false;
          setDataCollection({ step: 0, formData: {}, active: true });
          dataStartedRef.current = true;
          typeMessage(generateId(), COLETA_PERGUNTAS[0], Date.now());
          return;
        }
        typeMessage(generateId(), "Digite 'sim' para confirmar os dados ou 'não' para recomeçar.", Date.now());
        return;
      }

      // Armazena resposta no campo correto
      if (step === 0) newData.nome = text.trim();
      else if (step === 1) newData.telefone = text.trim();
      else if (step === 2) newData.email = text.trim();
      else if (step === 3) newData.placa = text.trim().toUpperCase().replace(/\s/g, "");
      else if (step === 4) newData.cidade = text.trim();

      const nextStep = step + 1;
      const userName = newData.nome;
      const userCity = newData.cidade;

      // Pula pergunta de cidade se já foi capturada na qualificação
      const temCidade = !!(newData.cidade);
      if (nextStep === 4 && temCidade) {
        const resumo = `Nome: ${newData.nome}\nWhatsApp: ${newData.telefone}\nEmail: ${newData.email}\nPlaca: ${newData.placa}\nCidade: ${newData.cidade}`;
        setDataCollection({ step: 5, formData: newData, active: true, userName, userCity });
        typeMessage(generateId(), `Perfeito! Confira seus dados:\n\n${resumo}\n\nTudo certo? Responda "sim" para confirmar ou "não" para recomeçar.`, Date.now());
        return;
      }

      if (nextStep === 5) {
        const resumo = `Nome: ${newData.nome}\nWhatsApp: ${newData.telefone}\nEmail: ${newData.email}\nPlaca: ${newData.placa}\nCidade: ${newData.cidade}`;
        setDataCollection({ step: 5, formData: newData, active: true, userName, userCity });
        typeMessage(generateId(), `Perfeito! Confira seus dados:\n\n${resumo}\n\nTudo certo? Responda "sim" para confirmar ou "não" para recomeçar.`, Date.now());
        return;
      }

      setDataCollection({ step: nextStep, formData: newData, active: true, userName, userCity });
      typeMessage(generateId(), COLETA_PERGUNTAS[nextStep], Date.now());
      return;
    }

    // Limpa coleta inativa (após rejeição) antes de seguir para AI
    if (dataCollection !== null && !dataCollection.active) {
      setDataCollection(null);
    }

    const lowerText = text.trim().toLowerCase();

    // Reenvio de card por solicitação
    if (lowerText.includes("manda o card") || lowerText.includes("envia de novo")) {
      if (planCardSent.current) {
        const img = selectedPlan.label === "Platina" ? "/cards/clube-platina.jpg"
          : selectedPlan.label === "Ouro" ? "/cards/clube-ouro.jpg" : "/cards/clube-prata.jpg";
        addImageCard(img);
      } else if (clubeCardSent.current) {
        addImageCard("/cards/clube-todos.png");
      }
    }

    // Gatilho manual do usuário para iniciar cadastro
    const userTriggers = [
      "quero garantir", "garantir minha vaga", "quero me cadastrar",
      "quero o platina", "quero o ouro", "quero o prata", "fechar o plano",
    ];
    if (userTriggers.some(t => lowerText.includes(t)) && !dataStartedRef.current) {
      const userPlanKey = (["platina", "ouro", "prata"] as const).find(p => lowerText.includes(p));
      const plan = userPlanKey ? PLAN_META[userPlanKey] : selectedPlan;
      const userMsg: Message = { id: generateId(), role: "user", text: text.trim(), timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      startDataCollection(plan);
      return;
    }

    // Extração de números para conta + cidade para pré-preencher coleta
    const currentStep = flowStepRef.current;
    if (currentStep === "corridas") {
      const n = extractNumber(text);
      if (n && n > 0) corridasRef.current = n;
    } else if (currentStep === "ticket") {
      const n = extractNumber(text);
      if (n && n > 0) ticketRef.current = n;
    } else if (currentStep === "cidade") {
      cityFromEarlierRef.current = text.trim();
    }

    const userMsg: Message = { id: generateId(), role: "user", text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const prevStep = flowStepRef.current;

    try {
      const history = messages
        .filter(m => m.text && !m.image && !m.audioUrl)
        .slice(-16)
        .map(m => ({
          role: m.role === "elton" ? "assistant" as const : "user" as const,
          content: m.text!,
        }));

      const res = await fetch("/api/elton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          conversationId: sessionId,
          vagasLote1: vagas,
          history,
        }),
      });
      const data = await res.json();

      if (data.message) {
        apiCallCountRef.current += 1;

        // Ticket → conta client-side
        if (prevStep === "ticket") {
          setLoading(false);
          setFlowStep("conta");
          scheduleTimer(() => { if (flowStepRef.current === "conta") dispararConta(); }, 600);
          scheduleTimer(() => inputRef.current?.focus(), 50);
          return;
        }

        await typeMessage(generateId(), data.message, Date.now());

        const msgLower = data.message.toLowerCase();

        // Card 2 após nome
        if (apiCallCountRef.current === 1 && !cardKRROSentRef.current) {
          cardKRROSentRef.current = true;
          setFlowStep("card");
          scheduleTimer(() => { addImageCard("/cards/cardk-rrobranco.png"); }, 2000);
        }

        // Clube card — dispara quando Elton usa a frase exata
        if (data.message.includes("Vou te mostrar o Clube K-RRO") && !clubeCardSent.current) {
          clubeCardSent.current = true;
          scheduleTimer(() => addImageCard("/cards/clube-todos.png"), 800);
        }

        // Plan card — suporta "R$397" e "R$ 397"
        const isPlatina = data.message.includes("Platina") && (data.message.includes("R$397") || data.message.includes("R$ 397"));
        const isOuro    = data.message.includes("Ouro")    && (data.message.includes("R$347") || data.message.includes("R$ 347"));
        const isPrata   = data.message.includes("Prata")   && (data.message.includes("R$297") || data.message.includes("R$ 297"));
        if ((isPlatina || isOuro || isPrata) && !planCardSent.current) {
          planCardSent.current = true;
          const planImg = isPlatina ? "/cards/clube-platina.jpg" : isOuro ? "/cards/clube-ouro.jpg" : "/cards/clube-prata.jpg";
          if (isPlatina) setSelectedPlan(PLAN_META.platina);
          else if (isOuro) setSelectedPlan(PLAN_META.ouro);
          else setSelectedPlan(PLAN_META.prata);
          scheduleTimer(() => addImageCard(planImg), 600);
        }

        // Inicia coleta de dados via chat (substitui modal)
        if (checkFormTrigger(data.message) && !dataStartedRef.current) {
          const aiPlanKey = (["platina", "ouro", "prata"] as const).find(p => msgLower.includes(p));
          const plan = aiPlanKey ? PLAN_META[aiPlanKey] : selectedPlan;
          setShowCollectionButton(true);
          scheduleTimer(() => startDataCollection(plan), 800);
        }

        // Step transitions
        if (prevStep === "pergunta")       setFlowStep("cidade");
        else if (prevStep === "cidade")    setFlowStep("carro");
        else if (prevStep === "carro")     setFlowStep("ano");
        else if (prevStep === "ano")       setFlowStep("corridas");
        else if (prevStep === "corridas")  setFlowStep("ticket");
      }
    } catch {
      typeMessage(generateId(), "Sistema instável. Tente novamente.", Date.now());
    } finally {
      setLoading(false);
      scheduleTimer(() => inputRef.current?.focus(), 50);
    }
  }

  // ─── Recording ───────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(blob);
        setMessages(prev => [...prev, { id: generateId(), role: "user", audioUrl, timestamp: Date.now() }]);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mrRef.current = mr;
      setIsRecording(true);
    } catch { /* mic unavailable */ }
  }

  function stopRecording() { mrRef.current?.stop(); mrRef.current = null; setIsRecording(false); }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes pulse-green{0%,100%{box-shadow:0 0 0 0 rgba(0,255,136,.5)}50%{box-shadow:0 0 0 4px rgba(0,255,136,0)}}
        .page-input:focus{border-color:#0066ff!important;outline:none;box-shadow:0 0 0 2px rgba(0,102,255,.2)}
        .page-input::placeholder{color:#555}
        .page-send:hover:not(:disabled){background:#0052cc!important}
        .page-online{animation:pulse-green 2s infinite}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
      `}</style>

      {/* Modal de entrada */}
      {showEntrada && (
        <div style={{ position:"fixed",inset:0,backgroundColor:"#000",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <img src="/cards/krro-apresentacao.png" alt="K-RRO"
            style={{ maxWidth:"100%",maxHeight:"100%",objectFit:"contain" }}
            onClick={() => setModalSrc("/cards/krro-apresentacao.png")} />
          <button onClick={handleEntradaClose} aria-label="Fechar"
            style={{ position:"absolute",top:20,right:20,background:"none",border:"none",color:"#fff",fontSize:32,cursor:"pointer",lineHeight:1,padding:"8px 12px",minWidth:44,minHeight:44 }}>
            ×
          </button>
        </div>
      )}

      {/* Chat */}
      <div className="relative w-full max-w-[480px] flex flex-col overflow-hidden"
        style={{ height:"100dvh",maxHeight:"100dvh",backgroundColor:"#0a0a0f",boxShadow:"0 0 40px rgba(0,102,255,0.25),inset 0 0 0 1px rgba(0,102,255,0.15)" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 z-10 flex-shrink-0"
          style={{ backgroundColor:"#0a0a0f",borderBottom:"1px solid #0066ff" }}>
          <img src="/logo-krro.png" alt="K-RRO"
            style={{ height:32,objectFit:"contain",flexShrink:0,filter:"brightness(0) invert(1)" }} />
          <div className="flex-1 min-w-0">
            <p style={{ color:"#ffffff",fontWeight:700,fontSize:14,lineHeight:1.2 }}>Elton</p>
            <p style={{ color:"#aaaaaa",fontSize:11 }}>Consultor K-RRO</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="page-online" style={{ width:8,height:8,borderRadius:"50%",background:"#00ff88",display:"inline-block" }} />
            <span style={{ color:"#00ff88",fontSize:11 }}>online</span>
          </div>
          {process.env.NEXT_PUBLIC_DEV_MODE === "true" && (
            <button onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="text-[10px] transition-colors flex-shrink-0 px-2 py-0.5 rounded"
              style={{ color:"#0066ff",border:"1px solid #0066ff" }} title="Limpar sessão (apenas dev)">
              Nova conversa
            </button>
          )}
        </div>

        {/* Mensagens */}
        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor:"#0a0a0f" }}>
          <img src="/logo-krro.png" alt="" aria-hidden="true"
            style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"70%",maxWidth:300,opacity:0.04,filter:"brightness(0) invert(1)",pointerEvents:"none",zIndex:0,userSelect:"none" }} />
          <div className="absolute inset-0 overflow-y-auto px-3 py-4 space-y-2" style={{ zIndex:1 }}>
            {messages.map((msg) => {
              const isElton = msg.role === "elton";
              if (isElton && msg.text !== undefined && !msg.image && !msg.audioUrl) {
                const clean = msg.text.replace(/\*\[.*?\]\*/g, "").trim();
                if (!clean) return null;
              }
              return (
                <div key={msg.id} className={`flex items-end gap-1.5 ${isElton ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[78%] px-3 py-2 text-sm leading-snug"
                    style={isElton
                      ? { backgroundColor:"#0d1117",borderLeft:"3px solid #0066ff",color:"#e0e0e0",borderRadius:"0 12px 12px 12px" }
                      : { backgroundColor:"#0066ff",color:"#ffffff",borderRadius:"12px 12px 0 12px" }}>
                    {msg.audioUrl && (
                      <audio controls src={msg.audioUrl} className="max-w-[220px]" style={{ height:36 }} />
                    )}
                    {typeof msg.text === "string" && (
                      <p className="whitespace-pre-wrap break-words">
                        {msg.text}
                        {typingMessageId === msg.id && (
                          <span style={{ animation:"blink 1s step-end infinite" }}>|</span>
                        )}
                      </p>
                    )}
                    {msg.image && (
                      <div className="mt-2">
                        <p style={{ color:"#888",fontSize:11,marginBottom:4 }}>📎 Card: {cardLabel(msg.image)}</p>
                        <img
                          src={msg.image}
                          alt={cardLabel(msg.image)}
                          className="w-full max-w-md rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                          onClick={() => setModalSrc(msg.image!)}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span suppressHydrationWarning className="text-[10px] tabular-nums font-mono" style={{ color:"#666666" }}>
                        {formatTime(msg.timestamp)}
                      </span>
                      {!isElton && <span className="text-[11px] leading-none text-white opacity-80">✓✓</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && !typingMessageId && (
              <div className="flex items-end justify-start">
                <div className="px-4 py-3"
                  style={{ backgroundColor:"#0d1117",borderLeft:"3px solid #0066ff",borderRadius:"0 12px 12px 12px" }}>
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map(delay => (
                      <span key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ backgroundColor:"#0066ff",animationDelay:`${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Botão de emergência — abre coleta se trigger detectado mas não iniciou */}
        {showCollectionButton && dataCollection === null && (
          <div style={{ padding:"6px 12px",flexShrink:0,backgroundColor:"#000" }}>
            <button onClick={() => startDataCollection(selectedPlan)}
              style={{ width:"100%",backgroundColor:"#0066ff",color:"#fff",border:"none",borderRadius:8,padding:"10px 0",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:0.3 }}>
              📋 Abrir Cadastro
            </button>
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
          style={{ backgroundColor:"#000000",borderTop:"1px solid #0066ff" }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(input); } }}
            placeholder={dataCollection !== null ? "Digite sua resposta..." : "Digite uma mensagem"}
            disabled={loading || typingMessageId !== null || showEntrada}
            className="page-input flex-1 rounded-full px-4 py-2 text-sm outline-none transition-colors disabled:opacity-40"
            style={{ backgroundColor:"#0d1117",border:"1px solid #222",color:"#ffffff",fontSize:16 }}
          />
          {input.trim() ? (
            <button onClick={() => sendText(input)} disabled={loading || typingMessageId !== null}
              aria-label="Enviar mensagem"
              className="page-send w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor:"#0066ff" }}>
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 translate-x-0.5">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          ) : (
            <button onMouseDown={startRecording} onMouseUp={stopRecording}
              onTouchStart={e => { e.preventDefault(); startRecording(); }}
              onTouchEnd={e => { e.preventDefault(); stopRecording(); }}
              aria-label={isRecording ? "Gravando — solte para enviar" : "Segure para gravar"}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
              style={{ backgroundColor:isRecording ? "#ef4444" : "#0066ff" }}>
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {modalSrc && <CardModal src={modalSrc} onClose={() => setModalSrc(null)} />}
    </div>
  );
}
