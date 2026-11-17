const GRAPH_VERSION = process.env.GRAPH_VERSION || "v25.0";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;

function normalizeToE164(number) {
  const digits = String(number).replace(/\D/g, "");
  // NÃºmeros brasileiros Ã s vezes chegam sem o 9Âº dÃ­gito (ex: 558185718061).
  // A API exige o formato completo com o 9 (ex: 5581985718061) para entregar a mensagem.
  if (digits.startsWith("55") && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    return `55${ddd}9${rest}`;
  }
  return digits;
}

async function callGraphAPI(payload) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[whatsapp] Erro na API:", JSON.stringify(data));
    throw new Error(`WhatsApp API error ${res.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function sendText(to, text) {
  return callGraphAPI({
    messaging_product: "whatsapp",
    to: normalizeToE164(to),
    type: "text",
    text: { body: text },
  });
}

export async function sendButtons(to, text, buttons) {
  return callGraphAPI({
    messaging_product: "whatsapp",
    to: normalizeToE164(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

export async function sendTemplate(to, name, languageCode = "pt_BR", components = []) {
  return callGraphAPI({
    messaging_product: "whatsapp",
    to: normalizeToE164(to),
    type: "template",
    template: {
      name,
      language: { code: languageCode },
      components,
    },
  });
}

export async function markAsRead(messageId) {
  return callGraphAPI({
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  });
}
