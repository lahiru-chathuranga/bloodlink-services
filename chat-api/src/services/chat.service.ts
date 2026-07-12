import type { ChatbotMessage } from "@prisma/client";
import { queryDialogflow } from "../lib/dialogflow";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

const FALLBACK_TEXT = "Sorry, I couldn't process that — try rephrasing.";

export interface ChatMessageDto {
  id: string;
  sender: "user" | "bot";
  messageText: string;
  matchedIntent: string | null;
  createdAt: string;
}

function toDto(message: ChatbotMessage): ChatMessageDto {
  return {
    id: message.id,
    sender: message.sender,
    messageText: message.messageText,
    matchedIntent: message.matchedIntent,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function getHistory(userId: string): Promise<{ items: ChatMessageDto[] }> {
  const messages = await prisma.chatbotMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return { items: messages.map(toDto) };
}

// Both messages persisted regardless of outcome — api-contract.md §4. On a
// Dialogflow timeout/error (or when it's not configured — see lib/dialogflow.ts),
// botMessage falls back to a canned response, persisted the same way so history
// stays consistent.
export async function postMessage(
  userId: string,
  message: string,
): Promise<{ userMessage: ChatMessageDto; botMessage: ChatMessageDto }> {
  const userMessage = await prisma.chatbotMessage.create({
    data: { userId, sender: "user", messageText: message, matchedIntent: null },
  });

  let responseText: string;
  let matchedIntent: string | null;
  try {
    const result = await queryDialogflow(userId, message);
    responseText = result.responseText;
    matchedIntent = result.matchedIntent;
  } catch (err) {
    logger.error({ err, userId }, "Dialogflow query failed — falling back to canned response");
    responseText = FALLBACK_TEXT;
    matchedIntent = null;
  }

  const botMessage = await prisma.chatbotMessage.create({
    data: { userId, sender: "bot", messageText: responseText, matchedIntent },
  });

  return { userMessage: toDto(userMessage), botMessage: toDto(botMessage) };
}
