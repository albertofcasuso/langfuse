import { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ConversationMessageSender } from "@langfuse/shared";

import { AssistantMessageComposer } from "./AssistantMessageComposer";
import { AssistantMessageList } from "./AssistantMessageList";
import { ConversationListSidebar } from "./ConversationListSidebar";

describe("assistant frontend components", () => {
  it("sends on Enter and keeps newline on Shift+Enter", () => {
    const onSend = jest.fn();

    render(
      <AssistantMessageComposer
        draft="Hello"
        onDraftChange={() => undefined}
        onSend={onSend}
        inputRef={{ current: null }}
      />,
    );

    const textarea = screen.getByLabelText("Message input");

    fireEvent.keyDown(textarea, { key: "Enter" });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("triggers new conversation callback from sidebar button", () => {
    const onCreateConversation = jest.fn();

    render(
      <ConversationListSidebar
        conversations={[]}
        selectedConversationId={undefined}
        isLoading={false}
        isCreatingConversation={false}
        onSelectConversation={() => undefined}
        onCreateConversation={onCreateConversation}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));

    expect(onCreateConversation).toHaveBeenCalledTimes(1);
  });

  it("renders timestamps and streaming state", () => {
    const firstTimestamp = new Date("2026-02-08T10:00:00.000Z");

    render(
      <AssistantMessageList
        hasSelectedConversation
        isLoading={false}
        messages={[
          {
            id: "user-1",
            conversationId: "conversation-1",
            sender: ConversationMessageSender.USER,
            content: "User message",
            timestamp: firstTimestamp,
          },
          {
            id: "assistant-1",
            conversationId: "conversation-1",
            sender: ConversationMessageSender.ASSISTANT,
            content: "",
            timestamp: new Date("2026-02-08T10:00:01.000Z"),
            isStreaming: true,
          },
        ]}
      />,
    );

    expect(screen.getByText("User message")).toBeInTheDocument();
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(
      screen.getByText(firstTimestamp.toLocaleString()),
    ).toBeInTheDocument();
  });

  it("focuses composer input after creating a new conversation", async () => {
    const FocusHarness = () => {
      const inputRef = useRef<HTMLTextAreaElement>(null);
      const [selectedConversationId, setSelectedConversationId] =
        useState<string>();

      const handleCreateConversation = () => {
        setSelectedConversationId("conversation-1");
        window.requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      };

      return (
        <div>
          <ConversationListSidebar
            conversations={[]}
            selectedConversationId={selectedConversationId}
            isLoading={false}
            isCreatingConversation={false}
            onSelectConversation={setSelectedConversationId}
            onCreateConversation={handleCreateConversation}
          />
          <AssistantMessageComposer
            draft=""
            onDraftChange={() => undefined}
            onSend={() => undefined}
            inputRef={inputRef}
            disabled={!selectedConversationId}
          />
        </div>
      );
    };

    render(<FocusHarness />);

    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Message input")).toHaveFocus();
    });
  });
});
