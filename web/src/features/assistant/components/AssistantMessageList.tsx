import { ConversationMessageSender } from "@langfuse/shared";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/src/utils/tailwind";

import { type AssistantUIMessage } from "./types";

type AssistantMessageListProps = {
  messages: AssistantUIMessage[];
  isLoading: boolean;
  hasSelectedConversation: boolean;
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleString();
}

export const AssistantMessageList = ({
  messages,
  isLoading,
  hasSelectedConversation,
}: AssistantMessageListProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessageFingerprint = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last) {
      return "";
    }

    return `${last.id}-${last.content.length}-${last.isStreaming ? "streaming" : "done"}`;
  }, [messages]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages.length, lastMessageFingerprint]);

  if (!hasSelectedConversation) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Select a conversation from the sidebar or create a new one.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading conversation...
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No messages yet. Send your first message.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col gap-3 overflow-y-auto px-3 py-4 md:px-5"
      aria-live="polite"
    >
      {messages.map((message) => {
        const isUserMessage = message.sender === ConversationMessageSender.USER;
        const showStreamingState =
          message.isStreaming && message.content.trim().length === 0;

        return (
          <div
            key={message.id}
            className={cn(
              "flex",
              isUserMessage ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-lg border px-3 py-2 text-sm shadow-sm",
                isUserMessage
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted",
                message.isOptimistic && "opacity-90",
              )}
            >
              <div className="whitespace-pre-wrap break-words">
                {showStreamingState ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Thinking...
                  </span>
                ) : (
                  message.content
                )}
                {message.isStreaming && message.content.trim().length > 0 ? (
                  <span className="ml-1 inline-block h-3 w-2 animate-pulse rounded-sm bg-current align-middle opacity-70" />
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-2 text-[11px]",
                  isUserMessage
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {formatDate(message.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
