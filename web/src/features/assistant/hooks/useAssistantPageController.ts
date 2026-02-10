import { useCallback, useEffect, useMemo } from "react";

import { useAssistantChatState } from "@/src/features/assistant/hooks/useAssistantChatState";
import { useAssistantConversations } from "@/src/features/assistant/hooks/useAssistantConversations";
import { useAssistantMessageActions } from "@/src/features/assistant/hooks/useAssistantMessageActions";
//INTERACTIVEAI: don't like the cross reference but it is used like that on other features (see evals and experiments)
import { useModelParams } from "@/src/features/playground/page/hooks/useModelParams";
import useProjectIdFromURL from "@/src/hooks/useProjectIdFromURL";
import { api } from "@/src/utils/api";
import { getFinalModelParams } from "@/src/utils/getFinalModelParams";

export const useAssistantPageController = () => {
  const projectId = useProjectIdFromURL();
  const utils = api.useUtils();
  const modelParamsContext = useModelParams();

  const {
    selectedConversationId,
    setSelectedConversationId,
    conversationsQuery,
    conversationQuery,
    createConversationMutation,
    createConversation: createConversationBase,
  } = useAssistantConversations({ projectId });

  const {
    draft,
    setDraft,
    isSending,
    setIsSending,
    setOptimisticUserMessage,
    setStreamingAssistantMessage,
    messageInputRef,
    buildOptimisticMessage,
    focusComposerInput,
    resetChatState,
    messages,
  } = useAssistantChatState({
    persistedMessages: conversationQuery.data?.messages,
    selectedConversationId,
  });

  useEffect(() => {
    setSelectedConversationId(undefined);
    resetChatState();
  }, [projectId, resetChatState, setSelectedConversationId]);

  const finalModelParams = useMemo(
    () => getFinalModelParams(modelParamsContext.modelParams),
    [modelParamsContext.modelParams],
  );

  const hasValidModelSelection = Boolean(
    finalModelParams.provider &&
      finalModelParams.model &&
      finalModelParams.adapter,
  );

  const createConversation = useCallback(async () => {
    const conversationId = await createConversationBase();
    if (!conversationId) {
      return;
    }

    resetChatState();
    focusComposerInput();
  }, [createConversationBase, focusComposerInput, resetChatState]);

  const { sendMessage } = useAssistantMessageActions({
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
  });

  return {
    modelParamsContext,
    hasValidModelSelection,
    selectedConversationId,
    setSelectedConversationId,
    conversationsQuery,
    conversationQuery,
    isCreatingConversation: createConversationMutation.isPending,
    createConversation,
    draft,
    setDraft,
    messages,
    messageInputRef,
    isSending,
    sendMessage,
  };
};

export type AssistantPageController = ReturnType<
  typeof useAssistantPageController
>;
