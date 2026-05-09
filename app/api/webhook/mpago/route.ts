import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { sendMessage } from "@/lib/whatsapp/client";
import bcrypt from "bcryptjs";

const resend = new Resend(process.env.RESEND_API_KEY);

function randomAlphanumeric(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function buildUsername(name: string, phone: string): string {
  const prefix = name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
  const suffix = phone.replace(/\D/g, "").slice(-4);
  return `${prefix}${suffix}`;
}

const PLAN_LABEL: Record<string, string> = {
  lote1: "PLATINA",
  lote2: "OURO",
  lote3: "PRATA",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { action, data } = body as {
      action: string;
      data?: { id?: string };
    };

    if (action !== "payment.updated" && action !== "payment.created") {
      return NextResponse.json({ received: true });
    }

    const paymentId = data?.id;
    if (!paymentId) return NextResponse.json({ received: true });

    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
    });
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    if (payment.status !== "approved") {
      return NextResponse.json({ received: true });
    }

    // external_reference = "conversationId|lockId|lot"
    const [conversationId, lockId, lot] = (payment.external_reference || "").split("|");
    if (!conversationId || !lockId) return NextResponse.json({ received: true });

    // Busca dados do motorista
    const { data: conv } = await supabaseAdmin
      .from("vendor_conversations")
      .select("driver_phone, driver_name, driver_city, driver_email, lot_offered, driver_address, driver_plate")
      .eq("id", conversationId)
      .single();

    // Atualiza conversa e lock
    await supabaseAdmin
      .from("vendor_conversations")
      .update({ payment_status: "approved", current_state: "completed" })
      .eq("id", conversationId);

    await supabaseAdmin
      .from("lot_locks")
      .update({ status: "converted" })
      .eq("id", lockId);

    // Atualiza inventário
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
          .update({ reserved: Math.max(0, inv.reserved - 1), sold: inv.sold + 1 })
          .eq("city", conv.driver_city)
          .eq("lot", lot);
      }
    }

    // ── Credenciais provisórias ───────────────────────────────────────────────
    const driverName  = conv?.driver_name  || "Motorista";
    const driverPhone = conv?.driver_phone || "";
    const driverEmail = conv?.driver_email || "";
    const driverCity  = conv?.driver_city  || "-";
    const planLabel   = PLAN_LABEL[lot] ?? lot?.toUpperCase() ?? "-";

    const username  = buildUsername(driverName, driverPhone);
    const passTemp  = randomAlphanumeric(8);
    const passHash  = await bcrypt.hash(passTemp, 10);

    // Reserva número do lote (ex: "042RSP")
    const stateCode = driverCity === "Porto Alegre" ? "RS"
      : driverCity === "Florianópolis" ? "SC"
      : driverCity === "Curitiba" ? "PR" : "BR";
    const planSuffix = lot === "lote1" ? "P" : lot === "lote2" ? "O" : "R";

    // Busca próximo número disponível no inventário
    const { data: invRow } = await supabaseAdmin
      .from("lot_inventory")
      .select("sold")
      .eq("city", conv?.driver_city ?? "")
      .eq("lot", lot)
      .single();
    const lotNumber = `${String((invRow?.sold ?? 1)).padStart(3, "0")}${stateCode}${planSuffix}`;

    // Cria driver com credenciais
    const { data: driver } = await supabaseAdmin
      .from("drivers")
      .insert({
        name:          driverName,
        phone:         driverPhone,
        email:         driverEmail,
        address:       conv?.driver_address || null,
        plate:         conv?.driver_plate   || null,
        plan:          planLabel,
        lot_number:    lotNumber,
        payment_id:    paymentId,
        payment_status: "approved",
        username,
        password_hash: passHash,
        password_temp: passTemp,
        status:        "active",
      })
      .select("id")
      .single();

    console.log(`[mpago] driver criado id=${driver?.id} username=${username} lote=${lotNumber}`);

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    if (driverPhone) {
      await sendMessage(
        driverPhone,
        `🎉 Bem-vindo ao Clube K-RRO, ${driverName}!\n` +
        `Seu número de fundador: #${lotNumber}\n` +
        `Plano: ${planLabel}\n\n` +
        `Suas credenciais provisórias:\n` +
        `Usuário: ${username}\n` +
        `Senha: ${passTemp}\n\n` +
        `Troque sua senha no primeiro acesso pelo app.\n` +
        `Qualquer dúvida é só chamar aqui. 🚗`
      );
    }

    // ── E-mail motorista ──────────────────────────────────────────────────────
    const fromEmail  = process.env.RESEND_FROM_EMAIL || "noreply@k-rro.com";
    const adminEmail = process.env.RESEND_ADMIN_EMAIL;

    if (driverEmail) {
      await resend.emails.send({
        from: fromEmail,
        to: driverEmail,
        subject: `Bem-vindo ao Clube K-RRO — Suas credenciais de acesso`,
        html: `
          <h2>🎉 Bem-vindo ao Clube K-RRO, ${driverName}!</h2>
          <p>Seu cadastro foi confirmado. Guarde estas informações:</p>
          <table cellpadding="6">
            <tr><td><b>Número de fundador:</b></td><td>#${lotNumber}</td></tr>
            <tr><td><b>Plano:</b></td><td>${planLabel}</td></tr>
            <tr><td><b>Usuário:</b></td><td>${username}</td></tr>
            <tr><td><b>Senha provisória:</b></td><td>${passTemp}</td></tr>
          </table>
          <p>Troque sua senha no primeiro acesso pelo app.<br>
          O link do app será enviado no dia <b>10/06/2026</b>.</p>
          <p>Dúvidas? Responda este e-mail ou fale pelo WhatsApp cadastrado.</p>
          <br><p>— Equipe K-RRO</p>
        `,
      });
    }

    // ── E-mail admin ──────────────────────────────────────────────────────────
    if (adminEmail) {
      const amount = ((payment.transaction_amount as number) || 0).toLocaleString(
        "pt-BR", { style: "currency", currency: "BRL" }
      );
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `✅ Novo fundador K-RRO — ${driverName} (${driverCity})`,
        html: `
          <h2>Novo pagamento aprovado 🎉</h2>
          <table cellpadding="6">
            <tr><td><b>Nome:</b></td><td>${driverName}</td></tr>
            <tr><td><b>Telefone:</b></td><td>${driverPhone}</td></tr>
            <tr><td><b>Cidade:</b></td><td>${driverCity}</td></tr>
            <tr><td><b>Lote:</b></td><td>${lotNumber}</td></tr>
            <tr><td><b>Plano:</b></td><td>${planLabel}</td></tr>
            <tr><td><b>Usuário:</b></td><td>${username}</td></tr>
            <tr><td><b>Valor:</b></td><td>${amount}</td></tr>
            <tr><td><b>Payment ID:</b></td><td>${paymentId}</td></tr>
            <tr><td><b>Driver ID:</b></td><td>${driver?.id ?? "-"}</td></tr>
          </table>
        `,
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[/api/webhook/mpago]", err);
    return NextResponse.json({ received: true });
  }
}
