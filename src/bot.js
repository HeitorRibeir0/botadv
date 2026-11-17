import { sendText, sendButtons } from "./whatsapp.js";

// Estado de conversa em memória, por número de telefone.
// Para produção real, troque por um banco de dados (Redis, Postgres, etc).
const sessions = new Map();

function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { step: "menu", data: {} });
  }
  return sessions.get(phone);
}

function resetSession(phone) {
  sessions.set(phone, { step: "menu", data: {} });
}

function isGreetingOrMenu(text) {
  const t = text.trim().toLowerCase();
  return ["menu", "oi", "ola", "olá", "inicio", "início", "start"].includes(t);
}

async function sendMainMenu(to) {
  await sendButtons(to, "Olá! Sou o assistente virtual do escritório. Como posso ajudar?", [
    { id: "agendar", title: "Agendar consulta" },
    { id: "processo", title: "Acompanhar processo" },
    { id: "humano", title: "Falar com advogada" },
  ]);
}

/**
 * Processa uma mensagem recebida (texto ou clique em botão) e decide a resposta.
 * @param {string} from Número de telefone do remetente (formato E.164 sem "+")
 * @param {{ type: "text"|"button", text?: string, buttonId?: string }} message
 */
export async function handleMessage(from, message) {
  const session = getSession(from);
  const text = message.text ? message.text.trim() : "";
  const buttonId = message.buttonId;

  // Comandos globais: sempre voltam ao menu
  if (buttonId === "menu" || (message.type === "text" && isGreetingOrMenu(text))) {
    resetSession(from);
    await sendMainMenu(from);
    return;
  }

  switch (session.step) {
    case "menu": {
      const escolha = buttonId || text.toLowerCase();

      if (escolha === "agendar" || escolha.includes("agendar")) {
        session.step = "agendar_nome";
        await sendText(from, "Vamos agendar sua consulta! Qual o seu nome completo?");
      } else if (escolha === "processo" || escolha.includes("processo")) {
        session.step = "processo_cpf";
        await sendText(from, "Certo! Me informe o CPF (somente números) vinculado ao processo.");
      } else if (escolha === "humano" || escolha.includes("humano") || escolha.includes("advogada")) {
        resetSession(from);
        await sendText(
          from,
          "Entendido! Uma de nossas advogadas dará continuidade ao seu atendimento em breve."
        );
        // TODO: notificar a equipe (ex.: enviar para um número interno ou sistema de tickets)
      } else {
        await sendMainMenu(from);
      }
      break;
    }

    case "agendar_nome": {
      session.data.nome = text;
      session.step = "agendar_assunto";
      await sendText(from, `Obrigado, ${text}! Qual o assunto da consulta?`);
      break;
    }

    case "agendar_assunto": {
      session.data.assunto = text;
      console.log("[agendamento] Novo agendamento solicitado:", session.data);
      // TODO: persistir o agendamento (banco de dados, planilha, calendário, etc.)
      await sendText(
        from,
        `Perfeito! Recebemos sua solicitação de consulta sobre "${session.data.assunto}". Nossa equipe entrará em contato para confirmar o horário.`
      );
      resetSession(from);
      break;
    }

    case "processo_cpf": {
      const cpf = text.replace(/\D/g, "");
      if (cpf.length !== 11) {
        await sendText(from, "CPF inválido. Por favor, envie os 11 números do CPF, sem pontos ou traços.");
        break;
      }
      session.data.cpf = cpf;
      console.log("[processo] Consulta de processo para CPF:", cpf);
      // TODO: integrar com o sistema real de consulta de processos
      await sendText(
        from,
        "Recebemos sua solicitação! Em breve retornaremos com a situação atualizada do seu processo."
      );
      resetSession(from);
      break;
    }

    default: {
      resetSession(from);
      await sendMainMenu(from);
    }
  }
}
