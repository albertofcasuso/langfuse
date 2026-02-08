import { SendHorizontal } from "lucide-react";
import { type KeyboardEvent, type RefObject } from "react";

import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";

type AssistantMessageComposerProps = {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
  isSending?: boolean;
};

export const AssistantMessageComposer = ({
  draft,
  onDraftChange,
  onSend,
  inputRef,
  disabled = false,
  isSending = false,
}: AssistantMessageComposerProps) => {
  const isSendDisabled = disabled || draft.trim().length === 0;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();

    if (!isSendDisabled) {
      onSend();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        ref={inputRef}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type your message..."
        aria-label="Message input"
        className="max-h-40 min-h-[56px] resize-y"
      />
      <Button
        type="button"
        onClick={onSend}
        loading={isSending}
        disabled={isSendDisabled}
        aria-label="Send message"
        className="gap-2"
      >
        {!isSending ? <SendHorizontal className="h-4 w-4" /> : null}
        Send
      </Button>
    </div>
  );
};
