import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { ReserveResponse, LotName } from "@/lib/types";
import { MercadoPagoConfig, Preference } from "mercadopago";

const LOT_PRICES: Record<LotName, number> = {
  lote1: 297,
  lote2: 347,
  lote3: 397,
  care: 1,
};

const LOT_LABELS: Record<LotName, string> = {
  lote1: "K-RRO Prata — Taxa 90% (6x sem juros)",
  lote2: "K-RRO Ouro — Taxa 92% (6x sem juros)",
  lote3: "K-RRO Platina — Taxa 94%",
  care: "K-RRO CARE — Validação Interna",
};

const PLANO_INFO: Record<string, { nome: string; percentual: string }> = {
  lote1: { nome: "Prata",   percentual: "90%" },
  lote2: { nome: "Ouro",    percentual: "92%" },
  lote3: { nome: "Platina", percentual: "94%" },
};

// Cascata de fallback: lote3 → lote2 → lote1
const LOT_CASCADE: Partial<Record<LotName, LotName[]>> = {
  lote3: ["lote3", "lote2", "lote1"],
  lote2: ["lote2", "lote1"],
  lote1: ["lote1"],
};

interface ReserveBody {
  driver_phone?: string;
  driver_name?: string;
  driver_city?: string;
  lot: LotName;
  conversation_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ReserveBody = await req.json();
    const {
      lot,
      conversation_id,
      driver_phone = "",
      driver_name = "",
      driver_city = "",
    } = body;

    if (!lot || !conversation_id) {
      return NextResponse.json<ReserveResponse>(
        { success: false, error: "lot e conversation_id são obrigatórios" },
        { status: 400 }
      );
    }

    // CARE: plano interno — apenas gera preferência MP com R$1,00, sem tocar estoque nem criar lock
    if (lot === "care") {
      const careClient = new MercadoPagoConfig({
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
      });
      const carePreference = new Preference(careClient);
      const careAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const carePref = await carePreference.create({
        body: {
          items: [{
            id: "care",
            title: "K-RRO CARE — Validação Interna",
            quantity: 1,
            unit_price: 1,
            currency_id: "BRL",
          }],
          payer: {
            name: driver_name || undefined,
            ...(driver_phone ? { phone: { number: driver_phone } } : {}),
          },
          external_reference: `${conversation_id}|care`,
          notification_url: `${careAppUrl}/api/webhook/mpago`,
          back_urls: {
            success: `${careAppUrl}/pre-lancamento?pagamento=aprovado&value=1`,
            failure: `${careAppUrl}/pre-lancamento?pagamento=falhou`,
            pending: `${careAppUrl}/pre-lancamento?pagamento=pendente`,
          },
          auto_return: "approved",
        },
      });
      const careUrl = carePref.init_point;
      if (!careUrl) {
        return NextResponse.json<ReserveResponse>(
          { success: false, error: "Falha ao gerar link CARE" },
          { status: 500 }
        );
      }
      return NextResponse.json<ReserveResponse>({ success: true, available: true, checkout_url: careUrl });
    }

    // Resolve a cidade: usa a informada ou lê do registro da conversa
    let city = driver_city;

    if (!city) {
      const { data: conv } = await supabaseAdmin
        .from("vendor_conversations")
        .select("driver_city")
        .eq("id", conversation_id)
        .single();
      city = conv?.driver_city ?? "";
    }

    // Fallback hierárquico por cidade, depois qualquer cidade, depois cascata de lote
    const cascade = LOT_CASCADE[lot] ?? [lot];

    let selectedLot: LotName = lot;
    let avail: { city: string; lot: string; total: number; reserved: number; sold: number } | null = null;

    for (const tryLot of cascade) {
      // Prioridade 1: cidade específica do motorista
      if (city) {
        const { data: cityRow } = await supabaseAdmin
          .from("lot_inventory")
          .select("city, lot, total, reserved, sold")
          .eq("lot", tryLot)
          .eq("city", city)
          .maybeSingle();

        if (cityRow && cityRow.total - cityRow.reserved - cityRow.sold > 0) {
          avail = cityRow;
          selectedLot = tryLot;
          break;
        }
      }

      // Prioridade 2: qualquer cidade com vagas no mesmo lote
      const { data: anyCity } = await supabaseAdmin
        .from("lot_inventory")
        .select("city, lot, total, reserved, sold")
        .eq("lot", tryLot);

      const found = (anyCity ?? []).find(r => r.total - r.reserved - r.sold > 0);
      if (found) {
        avail = found;
        selectedLot = tryLot;
        break;
      }
    }

    console.log("[RESERVE] lot solicitado:", lot, "selectedLot:", selectedLot, "cidade resolvida:", avail?.city ?? "nenhuma");

    if (!avail) {
      return NextResponse.json<ReserveResponse>(
        { success: false, available: false, error: "Lote esgotado" },
        { status: 409 }
      );
    }

    const resolvedCity = avail.city;
    const inventoryReserved = avail.reserved;

    // Expira locks antigos do mesmo motorista (se tivermos o telefone)
    if (driver_phone) {
      await supabaseAdmin
        .from("lot_locks")
        .update({ status: "expired" })
        .eq("driver_phone", driver_phone)
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString());
    }

    // Cria lock de 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // driver_phone NOT NULL na tabela — usa conversation_id como proxy quando vazio
    const phoneForLock = driver_phone || `conv_${conversation_id}`;

    const { data: lockData, error: lockErr } = await supabaseAdmin
      .from("lot_locks")
      .insert({
        driver_phone: phoneForLock,
        city: resolvedCity,
        lot: selectedLot,
        status: "active",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (lockErr || !lockData) {
      return NextResponse.json<ReserveResponse>(
        { success: false, error: "Erro ao criar reserva" },
        { status: 500 }
      );
    }

    // Incrementa contador de reservas no inventário
    await supabaseAdmin
      .from("lot_inventory")
      .update({ reserved: inventoryReserved + 1 })
      .eq("city", resolvedCity)
      .eq("lot", selectedLot);

    // Atualiza a conversa com os dados resolvidos
    await supabaseAdmin
      .from("vendor_conversations")
      .update({
        driver_phone: driver_phone || null,
        driver_name: driver_name || null,
        driver_city: resolvedCity || null,
        lot_offered: selectedLot,
        payment_status: "pending",
        current_state: "payment_pending",
      })
      .eq("id", conversation_id);

    // Gera preferência de pagamento no Mercado Pago
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const preference = new Preference(client);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const prefResult = await preference.create({
      body: {
        items: [
          {
            id: selectedLot,
            title: LOT_LABELS[selectedLot],
            quantity: 1,
            unit_price: LOT_PRICES[selectedLot],
            currency_id: "BRL",
          },
        ],
        payer: {
          name: driver_name || undefined,
          ...(driver_phone ? { phone: { number: driver_phone } } : {}),
        },
        external_reference: `${conversation_id}|${lockData.id}|${selectedLot}`,
        notification_url: `${appUrl}/api/webhook/mpago`,
        back_urls: {
          success: `${appUrl}/pre-lancamento?pagamento=aprovado&value=${LOT_PRICES[selectedLot]}`,
          failure: `${appUrl}/pre-lancamento?pagamento=falhou`,
          pending: `${appUrl}/pre-lancamento?pagamento=pendente`,
        },
        auto_return: "approved",
        expires: true,
        expiration_date_to: expiresAt,
        ...(selectedLot !== "lote1"
          ? { payment_methods: { installments: 6, default_installments: 6 } }
          : {}),
      },
    });

    const checkoutUrl = prefResult.init_point;

    if (!checkoutUrl) {
      return NextResponse.json<ReserveResponse>(
        { success: false, error: "Falha ao gerar link de pagamento" },
        { status: 500 }
      );
    }

    const fallbackOcorreu = selectedLot !== lot;
    return NextResponse.json<ReserveResponse>({
      success: true,
      available: true,
      checkout_url: checkoutUrl,
      lock_id: lockData.id as string,
      expires_at: expiresAt,
      ...(fallbackOcorreu ? {
        lotUsado: selectedLot,
        mensagem: `${PLANO_INFO[lot]?.nome ?? lot} esgotado. Sua vaga foi alocada no ${PLANO_INFO[selectedLot].nome} com ${PLANO_INFO[selectedLot].percentual}.`,
      } : {}),
    });
  } catch (err) {
    console.error("[/api/reserve]", err);
    return NextResponse.json<ReserveResponse>(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
