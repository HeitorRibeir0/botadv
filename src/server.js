import express from "express";
import crypto from "node:crypto";
import { handleMessage } from "./bot.js";
import { markAsRead } from "./whatsapp.js";

const app = express();

// Precisamos do corpo "raw" para validar a assinatura antes de fazer o parse em JSON.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const APP_SECRET = process.env.APP_SECRET;

// Deduplicação simples de mensagens (a Meta pode reenviar o mesmo evento).
const processedMessageIds = new Set();
function markProcessed(id) {
  processedMessageIds.add(id);
  if (processedMessageIds.size > 5000) {
    const first = processedMessageIds.values().next().value;
    processedMessageIds.delete(first);
  }
}

// --- Verificação do webhook (handshake inicial da Meta) ---
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[webhook] Verificado com sucesso.");
    return res.status(200).send(challenge);
  }

  console.warn("[webhook] Falha na verificação.");
  return res.sendStatus(403);
});

function isValidSignature(req) {
  const signature = req.get("X-Hub-Signature-256");
  if (!signature || !APP_SECRET || !req.rawBody) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(req.rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// --- Recebimento de eventos (mensagens, status, etc.) ---
app.post("/webhook", (req, res) => {
  if (!isValidSignature(req)) {
    console.warn("[webhook] Assinatura inválida.");
    return res.sendStatus(401);
  }

  // Responde imediatamente; processa de forma assíncrona depois.
  res.sendStatus(200);

  processWebhookEvent(req.body).catch((err) => {
    console.error("[webhook] Erro ao processar evento:", err);
  });
});

async function processWebhookEvent(body) {
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  if (!value) return;

  const messages = value.messages || [];
  const statuses = value.statuses || [];

  for (const status of statuses) {
    console.log("[status]", status.id, status.status);
  }

  for (const msg of messages) {
    if (processedMessageIds.has(msg.id)) continue;
    markProcessed(msg.id);

    const from = msg.from;
    const contactName = value.contacts?.[0]?.profile?.name || from;

    let parsed = { type: "text", text: "" };
    if (msg.type === "text") {
      parsed = { type: "text", text: msg.text.body };
    } else if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
      parsed = {
        type: "button",
        buttonId: msg.interactive.button_reply.id,
        text: msg.interactive.button_reply.title,
      };
    } else {
      console.log("[msg] Tipo de mensagem não tratado:", msg.type);
      continue;
    }

    console.log(`[msg] ${contactName} (${from}):`, parsed.text || parsed.buttonId);

    try {
      await markAsRead(msg.id);
    } catch (err) {
      console.error("[msg] Falha ao marcar como lida:", err.message);
    }

    try {
      await handleMessage(from, parsed);
    } catch (err) {
      console.error("[msg] Erro ao processar mensagem:", err);
    }
  }
}

app.get("/", (req, res) => {
  res.send("BotAdv está no ar.");
});

app.listen(PORT, () => {
  console.log(`BotAdv ouvindo em http://localhost:${PORT}`);
});
