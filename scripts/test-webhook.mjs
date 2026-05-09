/**
 * Simula o payload que a Meta envia ao webhook do WhatsApp.
 *
 * Uso:
 *   node scripts/test-webhook.mjs verify          → testa GET (verificação)
 *   node scripts/test-webhook.mjs message "oi"    → testa POST com mensagem
 *   node scripts/test-webhook.mjs message "oi" 5551999999999
 */

const BASE = process.env.WEBHOOK_URL || "http://localhost:3000";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "krro_webhook_2026";
const ENDPOINT = `${BASE}/api/whatsapp/webhook`;

const [, , cmd, text = "Olá, quero saber sobre a K-RRO", phone = "5551900000000"] = process.argv;

async function testVerify() {
  const url = `${ENDPOINT}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=CHALLENGE_TOKEN_123`;
  const res = await fetch(url);
  const body = await res.text();
  console.log(`[verify] status: ${res.status}`);
  console.log(`[verify] body:   ${body}`);
  if (res.status === 200 && body === "CHALLENGE_TOKEN_123") {
    console.log("✅ Verificação OK");
  } else {
    console.log("❌ Verificação FALHOU");
  }
}

async function testMessage(msgText, fromPhone) {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "ENTRY_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "15550000000", phone_number_id: "PHONE_ID" },
              messages: [
                {
                  from: fromPhone,
                  id: `wamid.test_${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: msgText },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  console.log(`[message] enviando: "${msgText}" de ${fromPhone}`);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  console.log(`[message] status: ${res.status}`);
  console.log(`[message] body:   ${body}`);
  if (res.status === 200) {
    console.log("✅ Webhook processou a mensagem (verifique os logs do servidor)");
  } else {
    console.log("❌ Webhook retornou erro");
  }
}

if (cmd === "verify") {
  await testVerify();
} else if (cmd === "message") {
  await testMessage(text, phone);
} else {
  console.log("Uso:");
  console.log("  node scripts/test-webhook.mjs verify");
  console.log('  node scripts/test-webhook.mjs message "sua mensagem"');
  console.log('  node scripts/test-webhook.mjs message "sua mensagem" 5551900000001');
}
