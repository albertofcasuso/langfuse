import { Plus } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/utils/tailwind";

import { type ConversationListItem } from "./types";

type ConversationListSidebarProps = {
  conversations: ConversationListItem[] | undefined;
  selectedConversationId?: string;
  isLoading: boolean;
  isCreatingConversation: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString();
}

export const ConversationListSidebar = ({
  conversations,
  selectedConversationId,
  isLoading,
  isCreatingConversation,
  onSelectConversation,
  onCreateConversation,
}: ConversationListSidebarProps) => {
  return (
    <aside className="flex h-full w-full flex-col border-b md:w-80 md:min-w-80 md:border-b-0 md:border-r">
      <div className="border-b p-3">
        <Button
          className="w-full justify-start gap-2"
          onClick={onCreateConversation}
          loading={isCreatingConversation}
          aria-label="New conversation"
        >
          {!isCreatingConversation ? <Plus className="h-4 w-4" /> : null}
          New Conversation
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            Loading conversations...
          </p>
        ) : null}

        {!isLoading && (conversations?.length ?? 0) === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No conversations yet.
          </p>
        ) : null}

        <div className="space-y-1">
          {(conversations ?? []).map((conversation) => {
            const isSelected = selectedConversationId === conversation.id;

            return (
              <button
                key={conversation.id}
                type="button"
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelectConversation(conversation.id)}
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <p className="text-xs font-medium text-foreground">
                  {`Conversation ${conversation.id.slice(4, 8)}`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(conversation.startedAt)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
