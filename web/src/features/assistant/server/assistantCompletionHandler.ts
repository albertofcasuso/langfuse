import { StreamingTextResponse } from "ai";
import { NextResponse, type NextRequest } from "next/server";

import { BaseError, InvalidRequestError } from "@langfuse/shared";

import { authorizeRequestOrThrow } from "@/src/server/utils/authorizeRequest";
import { SendMessageBody } from "@/src/features/assistant/validation";
import {
  createMessage,
  getConversationMessagesForLLM,
} from "@/src/features/assistant/server/service";

import { prisma } from "@langfuse/shared/src/db";
import { ConversationMessageSender } from "@langfuse/shared";
import {
  LLMApiKeySchema,
  logger,
  fetchLLMCompletion,
} from "@langfuse/shared/src/server";

export default async function assistantCompletionHandler(req: NextRequest) {
  try {
    const body = SendMessageBody.parse(await req.json());
    const { userId } = await authorizeRequestOrThrow(body.projectId);

    // Verify the conversation belongs to this user
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: body.conversationId,
        userId,
        projectId: body.projectId,
      },
    });

    if (!conversation) {
      throw new InvalidRequestError("Conversation not found");
    }

    // Get LLM API key for the project
    const llmApiKey = await prisma.llmApiKeys.findFirst({
      where: {
        projectId: body.projectId,
        provider: body.modelParams.provider,
      },
    });

    if (!llmApiKey) {
      throw new InvalidRequestError(
        `No ${body.modelParams.provider} API key found in project. Please add one in the project settings.`,
      );
    }

    const parsedKey = LLMApiKeySchema.safeParse(llmApiKey);
    if (!parsedKey.success) {
      throw new InvalidRequestError(
        `Could not parse API key for provider ${body.modelParams.provider}: ${parsedKey.error.message}`,
      );
    }

    // Save the user message only after all preconditions are validated
    await createMessage({
      conversationId: body.conversationId,
      sender: ConversationMessageSender.USER,
      content: body.content,
    });

    // Load full conversation history for LLM
    const messages = await getConversationMessagesForLLM({
      conversationId: body.conversationId,
    });

    // Call LLM with streaming
    const stream = await fetchLLMCompletion({
      llmConnection: parsedKey.data,
      messages,
      modelParams: {
        provider: body.modelParams.provider,
        model: body.modelParams.model,
        adapter: body.modelParams.adapter,
        temperature: body.modelParams.temperature,
        max_tokens: body.modelParams.max_tokens,
        top_p: body.modelParams.top_p,
      },
      streaming: true,
    });

    // Tee the stream: one for the client, one to capture the full response
    const [clientStream, captureStream] = stream.tee();

    // Background: accumulate the full response and save to DB
    void captureAndPersistResponse({
      stream: captureStream,
      conversationId: body.conversationId,
    });

    return new StreamingTextResponse(clientStream);
  } catch (err) {
    logger.error("Failed to handle assistant completion", err);

    if (err instanceof BaseError) {
      return NextResponse.json(
        { error: err.name, message: err.message },
        { status: err.httpCode },
      );
    }

    if (err instanceof Error) {
      const statusCode =
        (err as any)?.response?.status ?? (err as any)?.status ?? 500;

      return NextResponse.json(
        { message: err.message, error: err.name || "Error" },
        { status: statusCode },
      );
    }

    throw err;
  }
}

async function captureAndPersistResponse({
  stream,
  conversationId,
}: {
  stream: ReadableStream;
  conversationId: string;
}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullResponse += decoder.decode(value, { stream: true });
    }
    fullResponse += decoder.decode();

    if (fullResponse.length > 0) {
      await createMessage({
        conversationId,
        sender: ConversationMessageSender.ASSISTANT,
        content: fullResponse,
      });
    }
  } catch (err) {
    logger.error("Failed to capture assistant response", err);
  } finally {
    reader.releaseLock();
  }
}
