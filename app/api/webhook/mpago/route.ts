import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { MercadoPagoConfig, Payment } from "mercadopago";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Mercado Pago envia { action, data: { id } }
    const { action, data } = body as {
      action: string;
      data?: { id?: string };
    };

    if (action !== "payment.updated" && action !== "payment.created") {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    // Busca detalhes do pagamento no MP
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    if (payment.status !== "approved") {
      return NextResponse.json({ received: true });
    }

    // external_reference = "conversationId|lockId|lot"
    const [conversationId, lockId, lot] = (
      payment.external_reference || ""
    ).split("|");

    if (!conversationId || !lockId) {
      return NextResponse.json({ received: true });
    }

    // Busca a conversa para obter dados do motorista
    const { data: conv } = await supabaseAdmin
      .from("vendor_conversations")
      .select("driver_phone, driver_name, driver_city, lot_offered")
      .eq("id", conversationId)
      .single();

    // Atualiza conversa
    await supabaseAdmin
      .from("vendor_conversations")
      .update({
        payment_status: "approved",
        current_state: "completed",
      })
      .eq("id", conversationId);

    // Converte lock
    await supabaseAdmin
      .from("lot_locks")
      .update({ status: "converted" })
      .eq("id", lockId);

    // Atualiza inventário: decrementa reserved, incrementa sold
    if (conv?.driver_city && lot) {
      const { data: inv } = await supabaseAdmin
        .from("lot_inventory")
        .select("reserved, sold")
        .eq("city", conv.driver_city)
        .eq("lot", lot)
        .single();

      if (inv) {
        await supabaseAdmin
          .from("lot_inventory")
          .update({
            reserved: Math.max(0, inv.reserved - 1),
            sold: inv.sold + 1,
          })
          .eq("city", conv.driver_city)
          .eq("lot", lot);
      }
    }

    // Dispara e-mail de confirmação
    const driverName = conv?.driver_name || "Motorista";
    const driverPhone = conv?.driver_phone || "-";
    const driverCity = conv?.driver_city || "-";
    const lotLabel = lot?.toUpperCase() || "-";
    const amount = ((payment.transaction_amount as number) || 0).toLocaleString(
      "pt-BR",
      { style: "currency", currency: "BRL" }
    );

    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "noreply@example.com";
    const adminEmail = process.env.RESEND_ADMIN_EMAIL;

    // E-mail para o admin
    if (adminEmail) {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `✅ Novo parceiro K-RRO — ${driverName} (${driverCity})`,
        html: `
          <h2>Novo pagamento aprovado 🎉</h2>
          <table>
            <tr><td><b>Nome:</b></td><td>${driverName}</td></tr>
            <tr><td><b>Telefone:</b></td><td>${driverPhone}</td></tr>
            <tr><td><b>Cidade:</b></td><td>${driverCity}</td></tr>
            <tr><td><b>Lote:</b></td><td>${lotLabel}</td></tr>
            <tr><td><b>Valor:</b></td><td>${amount}</td></tr>
            <tr><td><b>ID Pagamento MP:</b></td><td>${paymentId}</td></tr>
            <tr><td><b>ID Conversa:</b></td><td>${conversationId}</td></tr>
          </table>
        `,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[/api/webhook/mpago]", err);
    // Retorna 200 para o MP não retentar
    return NextResponse.json({ received: true });
  }
}

// Necessário para o MP conseguir enviar o body
export const config = {
  api: { bodyParser: false },
};
