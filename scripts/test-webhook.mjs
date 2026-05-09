/**
 * Simula payloads que a Z-API envia ao webhook.
 *
 * Uso:
 *   node scripts/test-webhook.mjs get                          → testa GET
 *   node scripts/test-webhook.mjs message "oi"                 → mensagem de texto
 *   node scripts/test-webhook.mjs message "oi" 5551999999999   → telefone customizado
 *   node scripts/test-webhook.mjs button plan_platina           → clique em botão
 *   node scripts/test-webhook.mjs fromme                       → mensagem própria (deve ignorar)
 *   node scripts/test-webhook.mjs offensive                    → mensagem ofensiva
 */

const BASE     = process.env.WEBHOOK_URL || "http://localhost:3000";
const ENDPOINT = `${BASE}/api/whatsapp/webhook`;

const [, , cmd, arg1 = "Olá, quero saber sobre a K-RRO", arg2 = "5551900000000"] = process.argv;

async function post(payload) {
  const res  = await fetch(ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  const body = await res.text();
  console.log(`status: ${res.status}`);
  console.log(`body:   ${body}`);
  return res.status === 200;
}

// ── GET ───────────────────────────────────────────────────────────────────────
async function testGet() {
  const res  = await fetch(ENDPOINT);
  const body = await res.text();
  console.log(`[GET] status: ${res.status}  body: ${body}`);
  console.log(res.status === 200 ? "✅ GET OK" : "❌ GET FALHOU");
}

// ── Mensagem de texto ─────────────────────────────────────────────────────────
async function testMessage(text, phone) {
  console.log(`\n[message] "${text}" de ${phone}`);
  const ok = await post({ phone, fromMe: false, text: { message: text } });
  console.log(ok ? "✅ Processado (confira os logs do servidor)" : "❌ Erro");
}

// ── Clique em botão ───────────────────────────────────────────────────────────
async function testButton(buttonId, phone) {
  console.log(`\n[button] id="${buttonId}" de ${phone}`);
  const ok = await post({ phone, fromMe: false, buttonResponse: { selectedButtonId: buttonId } });
  console.log(ok ? "✅ Processado" : "❌ Erro");
}

// ── Mensagem própria (deve ser ignorada) ──────────────────────────────────────
async function testFromMe(phone) {
  console.log(`\n[fromMe] deve retornar 200 sem processar`);
  const ok = await post({ phone, fromMe: true, text: { message: "mensagem minha" } });
  console.log(ok ? "✅ Ignorado corretamente" : "❌ Erro");
}

// ── Mensagem ofensiva ─────────────────────────────────────────────────────────
async function testOffensive(phone) {
  console.log(`\n[offensive] filtro deve responder e encerrar`);
  const ok = await post({ phone, fromMe: false, text: { message: "seu viado" } });
  console.log(ok ? "✅ Filtrado (confira resposta no WhatsApp/log)" : "❌ Erro");
}

switch (cmd) {
  case "get":       await testGet(); break;
  case "message":   await testMessage(arg1, arg2); break;
  case "button":    await testButton(arg1, arg2); break;
  case "fromme":    await testFromMe(arg2); break;
  case "offensive": await testOffensive(arg2); break;
  default:
    console.log(`Uso:
  node scripts/test-webhook.mjs get
  node scripts/test-webhook.mjs message "texto" [phone]
  node scripts/test-webhook.mjs button plan_platina [phone]
  node scripts/test-webhook.mjs fromme [phone]
  node scripts/test-webhook.mjs offensive [phone]`);
}
