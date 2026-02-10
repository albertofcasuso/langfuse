import { prisma } from "@langfuse/shared/src/db";
import { ConversationMessageSender } from "@langfuse/shared";
import {
  ChatMessageRole,
  ChatMessageType,
  instrumentAsync,
} from "@langfuse/shared/src/server";
import type { ChatMessage } from "@langfuse/shared/src/server";

export async function listConversations({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) {
  return prisma.conversation.findMany({
    where: { userId, projectId },
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
  projectId,
}: {
  conversationId: string;
  userId: string;
  projectId: string;
}) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, userId, projectId },
    include: {
      messages: {
        orderBy: { timestamp: "asc" },
      },
    },
  });
}

export async function createConversation({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}) {
  return prisma.conversation.create({
    data: { userId, projectId },
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
  return instrumentAsync(
    { name: "assistant-service-create-message" },
    async (span) => {
      span.setAttributes({
        "assistant.conversation_id": conversationId,
        "assistant.message_sender": sender,
        "assistant.message_content_length": content.length,
      });

      const message = await prisma.message.create({
        data: { conversationId, sender, content },
      });

      span.setAttribute("assistant.message_id", message.id);
      return message;
    },
  );
}

export async function getConversationMessagesForLLM({
  conversationId,
}: {
  conversationId: string;
}): Promise<ChatMessage[]> {
  return instrumentAsync(
    { name: "assistant-service-get-messages-for-llm" },
    async (span) => {
      span.setAttribute("assistant.conversation_id", conversationId);

      const messages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { timestamp: "asc" },
      });

      let userMessages = 0;
      let assistantMessages = 0;

      const mappedMessages = messages.map((m) => {
        if (m.sender === ConversationMessageSender.USER) {
          userMessages += 1;
          return {
            type: ChatMessageType.User as const,
            role: ChatMessageRole.User as const,
            content: m.content,
          };
        }
        assistantMessages += 1;
        return {
          type: ChatMessageType.AssistantText as const,
          role: ChatMessageRole.Assistant as const,
          content: m.content,
        };
      });

      span.setAttributes({
        "assistant.message_count": messages.length,
        "assistant.user_message_count": userMessages,
        "assistant.assistant_message_count": assistantMessages,
      });

      return mappedMessages;
    },
  );
}
