import { useCallback, useEffect, useState } from "react";

import { showErrorToast } from "@/src/features/notifications/showErrorToast";
import { api } from "@/src/utils/api";

type UseAssistantConversationsParams = {
  projectId?: string;
};

export const useAssistantConversations = ({
  projectId,
}: UseAssistantConversationsParams) => {
  const utils = api.useUtils();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | undefined
  >(undefined);

  const conversationsQuery = api.assistant.listConversations.useQuery(
    { projectId: projectId ?? "" },
    { enabled: Boolean(projectId) },
  );

  const conversationQuery = api.assistant.getConversation.useQuery(
    {
      projectId: projectId ?? "",
      conversationId: selectedConversationId ?? "",
    },
    {
      enabled: Boolean(projectId && selectedConversationId),
      retry: false,
    },
  );

  const createConversationMutation =
    api.assistant.createConversation.useMutation();

  const createConversation = useCallback(async () => {
    if (!projectId || createConversationMutation.isPending) {
      return undefined;
    }

    try {
      const conversation = await createConversationMutation.mutateAsync({
        projectId,
      });

      await Promise.all([
        utils.assistant.listConversations.invalidate({ projectId }),
        utils.assistant.getConversation.invalidate({
          projectId,
          conversationId: conversation.id,
        }),
      ]);

      setSelectedConversationId(conversation.id);

      return conversation.id;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not create conversation.";
      showErrorToast("Failed to create conversation", message);

      return undefined;
    }
  }, [
    createConversationMutation,
    projectId,
    utils.assistant.getConversation,
    utils.assistant.listConversations,
  ]);

  useEffect(() => {
    const conversations = conversationsQuery.data;
    if (!conversations) {
      return;
    }

    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversationsQuery.data, selectedConversationId]);

  return {
    selectedConversationId,
    setSelectedConversationId,
    conversationsQuery,
    conversationQuery,
    createConversationMutation,
    createConversation,
  };
};
