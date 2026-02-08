import { ConversationMessageSender } from "@langfuse/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { type PersistedMessage } from "@/src/features/assistant/components/types";

import { useAssistantChatState } from "./useAssistantChatState";

type HookHarnessProps = {
  persistedMessages: PersistedMessage[];
  selectedConversationId?: string;
};

const HookHarness = ({
  persistedMessages,
  selectedConversationId,
}: HookHarnessProps) => {
  const {
    messages,
    setOptimisticUserMessage,
    setStreamingAssistantMessage,
    buildOptimisticMessage,
    messageInputRef,
    focusComposerInput,
  } = useAssistantChatState({
    persistedMessages,
    selectedConversationId,
  });

  return (
    <div>
      <textarea aria-label="Hook input" ref={messageInputRef} />
      <button
        onClick={() => {
          setOptimisticUserMessage(
            buildOptimisticMessage({
              id: "optimistic-selected",
              conversationId: "conversation-1",
              sender: ConversationMessageSender.USER,
              content: "Optimistic message",
              timestamp: new Date("2026-02-08T10:00:01.000Z"),
              isOptimistic: true,
            }),
          );
          setStreamingAssistantMessage(
            buildOptimisticMessage({
              id: "streaming-selected",
              conversationId: "conversation-1",
              sender: ConversationMessageSender.ASSISTANT,
              content: "Streaming message",
              timestamp: new Date("2026-02-08T10:00:03.000Z"),
              isStreaming: true,
            }),
          );
        }}
      >
        Set Selected Transients
      </button>
      <button
        onClick={() => {
          setStreamingAssistantMessage(
            buildOptimisticMessage({
              id: "streaming-first",
              conversationId: "conversation-1",
              sender: ConversationMessageSender.ASSISTANT,
              content: "Streaming first",
              timestamp: new Date("2026-02-08T10:00:01.000Z"),
              isStreaming: true,
            }),
          );
          setOptimisticUserMessage(
            buildOptimisticMessage({
              id: "optimistic-last",
              conversationId: "conversation-1",
              sender: ConversationMessageSender.USER,
              content: "Optimistic last",
              timestamp: new Date("2026-02-08T10:00:03.000Z"),
              isOptimistic: true,
            }),
          );
        }}
      >
        Set Out Of Order
      </button>
      <button onClick={focusComposerInput}>Focus Input</button>
      <div data-testid="message-ids">
        {messages.map((message) => message.id).join(",")}
      </div>
    </div>
  );
};

const createPersistedMessage = ({
  id,
  conversationId,
  timestamp,
}: {
  id: string;
  conversationId: string;
  timestamp: Date;
}) =>
  ({
    id,
    conversationId,
    sender: ConversationMessageSender.USER,
    content: `Persisted ${id}`,
    timestamp,
  }) as PersistedMessage;

describe("useAssistantChatState", () => {
  it("merges persisted and transient messages while showing transients only for the selected conversation", () => {
    const { rerender } = render(
      <HookHarness
        selectedConversationId="conversation-1"
        persistedMessages={[
          createPersistedMessage({
            id: "persisted-1",
            conversationId: "conversation-1",
            timestamp: new Date("2026-02-08T10:00:02.000Z"),
          }),
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Set Selected Transients" }),
    );

    expect(screen.getByTestId("message-ids")).toHaveTextContent(
      "optimistic-selected,persisted-1,streaming-selected",
    );

    rerender(
      <HookHarness
        selectedConversationId="conversation-2"
        persistedMessages={[
          createPersistedMessage({
            id: "persisted-2",
            conversationId: "conversation-2",
            timestamp: new Date("2026-02-08T10:00:02.000Z"),
          }),
        ]}
      />,
    );

    expect(screen.getByTestId("message-ids")).toHaveTextContent("persisted-2");
  });

  it("keeps messages ordered by timestamp", () => {
    render(
      <HookHarness
        selectedConversationId="conversation-1"
        persistedMessages={[
          createPersistedMessage({
            id: "persisted-middle",
            conversationId: "conversation-1",
            timestamp: new Date("2026-02-08T10:00:02.000Z"),
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Set Out Of Order" }));

    expect(screen.getByTestId("message-ids")).toHaveTextContent(
      "streaming-first,persisted-middle,optimistic-last",
    );
  });

  it("focuses the composer input on focusComposerInput", async () => {
    render(
      <HookHarness
        selectedConversationId="conversation-1"
        persistedMessages={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Focus Input" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Hook input")).toHaveFocus();
    });
  });
});
