import { type ConversationMessageSender } from "@langfuse/shared";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  type AssistantUIMessage,
  type PersistedMessage,
} from "@/src/features/assistant/components/types";

export type BuildOptimisticMessageInput = {
  id: string;
  conversationId: string;
  sender: ConversationMessageSender;
  content: string;
  timestamp: Date;
  isOptimistic?: boolean;
  isStreaming?: boolean;
};

type UseAssistantChatStateParams = {
  persistedMessages?: PersistedMessage[];
  selectedConversationId?: string;
};

export const useAssistantChatState = ({
  persistedMessages = [],
  selectedConversationId,
}: UseAssistantChatStateParams) => {
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [optimisticUserMessage, setOptimisticUserMessage] =
    useState<AssistantUIMessage | null>(null);
  const [streamingAssistantMessage, setStreamingAssistantMessage] =
    useState<AssistantUIMessage | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const buildOptimisticMessage = useCallback(
    ({
      id,
      conversationId,
      sender,
      content,
      timestamp,
      isOptimistic,
      isStreaming,
    }: BuildOptimisticMessageInput): AssistantUIMessage => {
      return {
        id,
        conversationId,
        sender,
        content,
        timestamp,
        isOptimistic,
        isStreaming,
      };
    },
    [],
  );

  const focusComposerInput = useCallback(() => {
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
      return;
    }

    messageInputRef.current?.focus();
  }, []);

  const resetChatState = useCallback(() => {
    setDraft("");
    setIsSending(false);
    setOptimisticUserMessage(null);
    setStreamingAssistantMessage(null);
  }, []);

  const persistedMessagesForUI = useMemo<AssistantUIMessage[]>(() => {
    return persistedMessages.map((message) =>
      buildOptimisticMessage({
        id: message.id,
        conversationId: message.conversationId,
        sender: message.sender,
        content: message.content,
        timestamp: new Date(message.timestamp),
      }),
    );
  }, [buildOptimisticMessage, persistedMessages]);

  const messages = useMemo(() => {
    const mergedMessages = [...persistedMessagesForUI];

    if (
      optimisticUserMessage &&
      optimisticUserMessage.conversationId === selectedConversationId
    ) {
      mergedMessages.push(optimisticUserMessage);
    }

    if (
      streamingAssistantMessage &&
      streamingAssistantMessage.conversationId === selectedConversationId
    ) {
      mergedMessages.push(streamingAssistantMessage);
    }

    return mergedMessages.sort(
      (left, right) => left.timestamp.getTime() - right.timestamp.getTime(),
    );
  }, [
    optimisticUserMessage,
    persistedMessagesForUI,
    selectedConversationId,
    streamingAssistantMessage,
  ]);

  return {
    draft,
    setDraft,
    isSending,
    setIsSending,
    optimisticUserMessage,
    setOptimisticUserMessage,
    streamingAssistantMessage,
    setStreamingAssistantMessage,
    messageInputRef,
    buildOptimisticMessage,
    focusComposerInput,
    resetChatState,
    messages,
  };
};
