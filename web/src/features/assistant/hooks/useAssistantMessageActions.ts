import { ConversationMessageSender } from "@langfuse/shared";
import { type ModelParams } from "@langfuse/shared";
import { type Dispatch, type SetStateAction, useCallback } from "react";

import { type AssistantUIMessage } from "@/src/features/assistant/components/types";
import { type BuildOptimisticMessageInput } from "@/src/features/assistant/hooks/useAssistantChatState";
import { showErrorToast } from "@/src/features/notifications/showErrorToast";
import { env } from "@/src/env.mjs";

type AssistantUtils = {
  assistant: {
    getConversation: {
      invalidate: (input: {
        projectId: string;
        conversationId: string;
      }) => Promise<unknown>;
    };
    listConversations: {
      invalidate: (input: { projectId: string }) => Promise<unknown>;
    };
  };
};

type UseAssistantMessageActionsParams = {
  projectId?: string;
  selectedConversationId?: string;
  finalModelParams: ModelParams;
  hasValidModelSelection: boolean;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  isSending: boolean;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setOptimisticUserMessage: Dispatch<SetStateAction<AssistantUIMessage | null>>;
  setStreamingAssistantMessage: Dispatch<
    SetStateAction<AssistantUIMessage | null>
  >;
  buildOptimisticMessage: (
    input: BuildOptimisticMessageInput,
  ) => AssistantUIMessage;
  focusComposerInput: () => void;
  utils: AssistantUtils;
};

export const useAssistantMessageActions = ({
  projectId,
  selectedConversationId,
  finalModelParams,
  hasValidModelSelection,
  draft,
  setDraft,
  isSending,
  setIsSending,
  setOptimisticUserMessage,
  setStreamingAssistantMessage,
  buildOptimisticMessage,
  focusComposerInput,
  utils,
}: UseAssistantMessageActionsParams) => {
  const sendMessage = useCallback(async () => {
    const activeProjectId = projectId;
    const conversationId = selectedConversationId;
    const content = draft.trim();

    if (
      isSending ||
      !activeProjectId ||
      !conversationId ||
      content.length === 0
    ) {
      return;
    }

    if (!hasValidModelSelection) {
      showErrorToast(
        "Model not configured",
        "Select provider and model before sending a message.",
      );
      return;
    }

    const now = Date.now();
    const optimisticMessage = buildOptimisticMessage({
      id: `user-${now}`,
      conversationId,
      sender: ConversationMessageSender.USER,
      content,
      timestamp: new Date(now),
      isOptimistic: true,
    });

    const streamingMessageId = `assistant-${now}`;

    setIsSending(true);
    setDraft("");
    setOptimisticUserMessage(optimisticMessage);
    setStreamingAssistantMessage(
      buildOptimisticMessage({
        id: streamingMessageId,
        conversationId,
        sender: ConversationMessageSender.ASSISTANT,
        content: "",
        timestamp: new Date(now + 1),
        isStreaming: true,
      }),
    );

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: activeProjectId,
            conversationId,
            content,
            modelParams: finalModelParams,
          }),
        },
      );

      if (!response.ok) {
        const errorPayload = await response
          .json()
          .catch(() => ({ message: "Request failed" }));

        throw new Error(errorPayload.message ?? "Request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to read assistant response stream");
      }

      const decoder = new TextDecoder("utf-8");
      let fullResponse = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          fullResponse += decoder.decode(value, { stream: true });

          setStreamingAssistantMessage((current) => {
            if (!current || current.id !== streamingMessageId) {
              return current;
            }

            return {
              ...current,
              content: fullResponse,
            };
          });
        }

        fullResponse += decoder.decode();

        setStreamingAssistantMessage((current) => {
          if (!current || current.id !== streamingMessageId) {
            return current;
          }

          return {
            ...current,
            content: fullResponse,
          };
        });
      } finally {
        reader.releaseLock();
      }

      await Promise.all([
        utils.assistant.getConversation.invalidate({
          projectId: activeProjectId,
          conversationId,
        }),
        utils.assistant.listConversations.invalidate({
          projectId: activeProjectId,
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      showErrorToast("Failed to send message", message);

      await utils.assistant.getConversation.invalidate({
        projectId: activeProjectId,
        conversationId,
      });
    } finally {
      setIsSending(false);
      setOptimisticUserMessage(null);
      setStreamingAssistantMessage(null);
      focusComposerInput();
    }
  }, [
    buildOptimisticMessage,
    draft,
    finalModelParams,
    focusComposerInput,
    hasValidModelSelection,
    isSending,
    projectId,
    selectedConversationId,
    setDraft,
    setIsSending,
    setOptimisticUserMessage,
    setStreamingAssistantMessage,
    utils.assistant.getConversation,
    utils.assistant.listConversations,
  ]);

  return {
    sendMessage,
  };
};
