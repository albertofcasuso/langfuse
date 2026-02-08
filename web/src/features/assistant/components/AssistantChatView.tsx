import { type RefObject } from "react";

import { AssistantMessageComposer } from "./AssistantMessageComposer";
import { AssistantMessageList } from "./AssistantMessageList";
import { type AssistantUIMessage } from "./types";

type AssistantChatViewProps = {
  selectedConversationId?: string;
  messages: AssistantUIMessage[];
  isLoadingConversation: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isSending: boolean;
  canSend: boolean;
};

export const AssistantChatView = ({
  selectedConversationId,
  messages,
  isLoadingConversation,
  draft,
  onDraftChange,
  onSend,
  inputRef,
  isSending,
  canSend,
}: AssistantChatViewProps) => {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <AssistantMessageList
          messages={messages}
          isLoading={isLoadingConversation}
          hasSelectedConversation={Boolean(selectedConversationId)}
        />
      </div>

      <div className="border-t p-3 md:p-4">
        <AssistantMessageComposer
          draft={draft}
          onDraftChange={onDraftChange}
          onSend={onSend}
          inputRef={inputRef}
          disabled={!selectedConversationId || !canSend || isSending}
          isSending={isSending}
        />
      </div>
    </section>
  );
};
