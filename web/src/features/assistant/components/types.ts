import { type ConversationMessageSender } from "@langfuse/shared";

import { type RouterOutputs } from "@/src/utils/api";

export type ConversationListItem =
  RouterOutputs["assistant"]["listConversations"][number];

export type PersistedConversation =
  RouterOutputs["assistant"]["getConversation"];
export type PersistedMessage = PersistedConversation["messages"][number];

export type AssistantUIMessage = {
  id: string;
  conversationId: string;
  sender: ConversationMessageSender;
  content: string;
  timestamp: Date;
  isOptimistic?: boolean;
  isStreaming?: boolean;
};
