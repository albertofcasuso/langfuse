import { ModelParameters } from "@/src/components/ModelParameters";
import Page from "@/src/components/layouts/page";
import {
  AssistantChatView,
  ConversationListSidebar,
} from "@/src/features/assistant/components";
import { useAssistantPageController } from "@/src/features/assistant/hooks";

export default function AssistantPage() {
  const {
    modelParamsContext,
    hasValidModelSelection,
    selectedConversationId,
    setSelectedConversationId,
    conversationsQuery,
    conversationQuery,
    isCreatingConversation,
    createConversation,
    draft,
    setDraft,
    messages,
    messageInputRef,
    isSending,
    sendMessage,
  } = useAssistantPageController();

  return (
    <Page
      headerProps={{
        title: "Assistant",
      }}
      withPadding={false}
      scrollable={false}
    >
      <div className="flex h-full min-h-0 flex-col md:flex-row">
        <ConversationListSidebar
          conversations={conversationsQuery.data}
          selectedConversationId={selectedConversationId}
          isLoading={conversationsQuery.isLoading}
          isCreatingConversation={isCreatingConversation}
          onSelectConversation={setSelectedConversationId}
          onCreateConversation={createConversation}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-3 py-2 md:px-4">
            <ModelParameters
              {...modelParamsContext}
              layout="compact"
              formDisabled={isSending}
            />
          </div>

          <AssistantChatView
            selectedConversationId={selectedConversationId}
            messages={messages}
            isLoadingConversation={conversationQuery.isLoading}
            draft={draft}
            onDraftChange={setDraft}
            onSend={() => {
              void sendMessage();
            }}
            inputRef={messageInputRef}
            isSending={isSending}
            canSend={hasValidModelSelection}
          />
        </div>
      </div>
    </Page>
  );
}
