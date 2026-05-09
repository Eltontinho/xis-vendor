import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { MercadoPagoConfig, Payment, PaymentRefund } from "mercadopago";
import { sendMessage } from "@/lib/whatsapp/client";

const resend = new Resend(process.env.RESEND_API_KEY);
const REFUND_WINDOW_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const { driverId, reason } = await req.json() as {
      driverId?: string;
      reason?: string;
    };

    if (!driverId) {
      return NextResponse.json({ error: "missing driverId" }, { status: 400 });
    }

    // Busca driver
    const { data: driver, error: driverErr } = await supabaseAdmin
      .from("drivers")
      .select("*")
      .eq("id", driverId)
      .single();

    if (driverErr || !driver) {
      return NextResponse.json({ error: "driver not found" }, { status: 404 });
    }

    if (driver.status === "refunded") {
      return NextResponse.json({ error: "already refunded" }, { status: 409 });
    }

    // Verifica janela de 7 dias
    const createdAt = new Date(driver.created_at);
    const daysDiff  = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > REFUND_WINDOW_DAYS) {
      return NextResponse.json(
        { error: `refund window expired (${Math.floor(daysDiff)} days since purchase)` },
        { status: 422 }
      );
    }

    // Estorna no Mercado Pago
    if (driver.payment_id) {
      const client = new MercadoPagoConfig({
        accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
      });
      const refundClient = new PaymentRefund(client);
      await refundClient.create({ payment_id: driver.payment_id });
    }

    // Atualiza driver
    await supabaseAdmin
      .from("drivers")
      .update({ status: "refunded" })
      .eq("id", driverId);

    // Atualiza inventário: sold - 1
    if (driver.plan && driver.phone) {
      const lotMap: Record<string, string> = { PLATINA: "lote1", OURO: "lote2", PRATA: "lote3" };
      const lot = lotMap[driver.plan];

      // Descobre cidade pela conversa (tenta pelo telefone)
      const { data: conv } = await supabaseAdmin
        .from("vendor_conversations")
        .select("driver_city")
        .eq("driver_phone", driver.phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (conv?.driver_city && lot) {
        const { data: inv } = await supabaseAdmin
          .from("lot_inventory")
          .select("sold, reserved")
          .eq("city", conv.driver_city)
          .eq("lot", lot)
          .single();

        if (inv) {
          await supabaseAdmin
            .from("lot_inventory")
            .update({
              sold:     Math.max(0, inv.sold - 1),
              reserved: Math.max(0, inv.reserved - 1),
            })
            .eq("city", conv.driver_city)
            .eq("lot", lot);
        }
      }
    }

    // Move para common_drivers
    await supabaseAdmin.from("common_drivers").insert({
      name:    driver.name,
      phone:   driver.phone,
      email:   driver.email,
      address: driver.address,
      plate:   driver.plate,
      origin:  "refund",
    });

    // WhatsApp
    if (driver.phone) {
      await sendMessage(
        driver.phone,
        `✅ Reembolso processado, ${driver.name ?? "motorista"}.\n\n` +
        `Você ainda pode acessar a K-RRO como motorista comum com 85% por corrida após o lançamento.\n\n` +
        `Se mudar de ideia, é só chamar aqui. 🚗`
      );
    }

    // E-mail
    const fromEmail  = process.env.RESEND_FROM_EMAIL || "noreply@k-rro.com";
    const adminEmail = process.env.RESEND_ADMIN_EMAIL;

    if (driver.email) {
      await resend.emails.send({
        from: fromEmail,
        to: driver.email,
        subject: "Reembolso K-RRO confirmado",
        html: `
          <h2>Reembolso confirmado</h2>
          <p>Olá, ${driver.name ?? "motorista"}.</p>
          <p>Seu reembolso foi processado com sucesso. O valor retorna ao método de pagamento original em até 5 dias úteis.</p>
          <p>Mesmo assim, você está cadastrado como motorista comum e terá acesso à K-RRO com <b>85% por corrida</b> após o lançamento em 15/06/2026.</p>
          <p>Qualquer dúvida, responda este e-mail.</p>
          <br><p>— Equipe K-RRO</p>
        `,
      });
    }

    if (adminEmail) {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `⚠️ Reembolso — ${driver.name} (${driver.plan})`,
        html: `
          <h2>Reembolso processado</h2>
          <table cellpadding="6">
            <tr><td><b>Nome:</b></td><td>${driver.name}</td></tr>
            <tr><td><b>Telefone:</b></td><td>${driver.phone}</td></tr>
            <tr><td><b>Plano:</b></td><td>${driver.plan}</td></tr>
            <tr><td><b>Lote:</b></td><td>${driver.lot_number}</td></tr>
            <tr><td><b>Motivo:</b></td><td>${reason ?? "não informado"}</td></tr>
            <tr><td><b>Driver ID:</b></td><td>${driverId}</td></tr>
          </table>
        `,
      });
    }

    return NextResponse.json({ refunded: true });
  } catch (err) {
    console.error("[/api/refund]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
