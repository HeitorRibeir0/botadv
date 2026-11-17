const GRAPH_VERSION = process.env.GRAPH_VERSION || "v25.0";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const BASE_URL = \`https://graph.facebook.com/\${GRAPH_VERSION}/\${PHONE_NUMBER_ID}/messages\`;

async function callGraphAPI(payload) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: \`Bearer \${WHATSAPP_TOKEN}\`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error("[whatsapp] Erro na API:", JSON.stringify(data));
    throw new Error(\`WhatsApp API error \${res.status}: \${JSON.stringify(data)}\`);
  }

  return data;
}

export async function sendText(to, text) {
  return callGraphAPI({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendButtons(to, text, buttons) {
  return callGraphAPI({
    messaging_product: "whatsapp",
    to,
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
    to,
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
