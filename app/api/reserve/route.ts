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
  lote1: "K-RRO Lote 1 — Taxa 94%",
  lote2: "K-RRO Lote 2 — Taxa 92% (6x sem juros)",
  lote3: "K-RRO Lote 3 — Taxa 90% (6x sem juros)",
  care: "K-RRO CARE — Validação Interna",
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

    // Sempre busca sem filtro de cidade — seleciona qualquer registro do lote com vagas disponíveis
    const { data: allInv } = await supabaseAdmin
      .from("lot_inventory")
      .select("city, total, reserved, sold")
      .eq("lot", lot);

    const avail = (allInv ?? []).find(r => r.total - r.reserved - r.sold > 0);

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
        lot,
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
      .eq("lot", lot);

    // Atualiza a conversa com os dados resolvidos
    await supabaseAdmin
      .from("vendor_conversations")
      .update({
        driver_phone: driver_phone || null,
        driver_name: driver_name || null,
        driver_city: resolvedCity || null,
        lot_offered: lot,
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
            id: lot,
            title: LOT_LABELS[lot],
            quantity: 1,
            unit_price: LOT_PRICES[lot],
            currency_id: "BRL",
          },
        ],
        payer: {
          name: driver_name || undefined,
          ...(driver_phone ? { phone: { number: driver_phone } } : {}),
        },
        external_reference: `${conversation_id}|${lockData.id}|${lot}`,
        notification_url: `${appUrl}/api/webhook/mpago`,
        back_urls: {
          success: `${appUrl}/pre-lancamento?pagamento=aprovado&value=${LOT_PRICES[lot]}`,
          failure: `${appUrl}/pre-lancamento?pagamento=falhou`,
          pending: `${appUrl}/pre-lancamento?pagamento=pendente`,
        },
        auto_return: "approved",
        expires: true,
        expiration_date_to: expiresAt,
        ...(lot !== "lote1"
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

    return NextResponse.json<ReserveResponse>({
      success: true,
      available: true,
      checkout_url: checkoutUrl,
      lock_id: lockData.id as string,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[/api/reserve]", err);
    return NextResponse.json<ReserveResponse>(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
