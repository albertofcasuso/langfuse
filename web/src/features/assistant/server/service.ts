import { prisma } from "@langfuse/shared/src/db";
import { ConversationMessageSender } from "@langfuse/shared";
import { ChatMessageRole, ChatMessageType } from "@langfuse/shared/src/server";
import type { ChatMessage } from "@langfuse/shared/src/server";

export async function listConversations({ userId }: { userId: string }) {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
    },
  });
}

export async function getConversation({
  conversationId,
  userId,
}: {
  conversationId: string;
  userId: string;
}) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: {
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function createConversation({ userId }: { userId: string }) {
  return prisma.conversation.create({
    data: { userId },
    select: { id: true },
  });
}

export async function createMessage({
  conversationId,
  sender,
  content,
}: {
  conversationId: string;
  sender: ConversationMessageSender;
  content: string;
}) {
  return prisma.message.create({
    data: { conversationId, sender, content },
  });
}

export async function getConversationMessagesForLLM({
  conversationId,
}: {
  conversationId: string;
}): Promise<ChatMessage[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { timestamp: "asc" },
  });

  return messages.map((m) => {
    if (m.sender === ConversationMessageSender.USER) {
      return {
        type: ChatMessageType.User as const,
        role: ChatMessageRole.User as const,
        content: m.content,
      };
    }
    return {
      type: ChatMessageType.AssistantText as const,
      role: ChatMessageRole.Assistant as const,
      content: m.content,
    };
  });
}
