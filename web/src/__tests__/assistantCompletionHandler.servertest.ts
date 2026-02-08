/** @jest-environment node */

import type { NextRequest } from "next/server";

jest.mock("../server/utils/authorizeRequest", () => ({
  authorizeRequestOrThrow: jest.fn(),
}));

jest.mock("../features/assistant/server/service", () => ({
  createMessage: jest.fn(),
  getConversationMessagesForLLM: jest.fn(),
}));

jest.mock("@langfuse/shared/src/db", () => ({
  prisma: {
    conversation: {
      findFirst: jest.fn(),
    },
    llmApiKeys: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("@langfuse/shared/src/server", () => {
  const actual = jest.requireActual("@langfuse/shared/src/server");

  return {
    ...actual,
    fetchLLMCompletion: jest.fn(),
    LLMApiKeySchema: {
      safeParse: jest.fn(),
    },
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
  };
});

import { authorizeRequestOrThrow } from "../server/utils/authorizeRequest";
import {
  createMessage,
  getConversationMessagesForLLM,
} from "../features/assistant/server/service";
import { prisma } from "@langfuse/shared/src/db";
import {
  fetchLLMCompletion,
  LLMApiKeySchema,
  logger,
} from "@langfuse/shared/src/server";
import { ConversationMessageSender, LLMAdapter } from "@langfuse/shared";
import assistantCompletionHandler from "../features/assistant/server/assistantCompletionHandler";

const mockAuthorizeRequestOrThrow = authorizeRequestOrThrow as jest.Mock;
const mockCreateMessage = createMessage as jest.Mock;
const mockGetConversationMessagesForLLM =
  getConversationMessagesForLLM as jest.Mock;
const mockConversationFindFirst = prisma.conversation.findFirst as jest.Mock;
const mockLlmApiKeysFindFirst = prisma.llmApiKeys.findFirst as jest.Mock;
const mockFetchLLMCompletion = fetchLLMCompletion as jest.Mock;
const mockLlmApiKeySafeParse = LLMApiKeySchema.safeParse as jest.Mock;
const mockLoggerError = logger.error as jest.Mock;

const encoder = new TextEncoder();
const baseBody = {
  projectId: "project-id",
  conversationId: "conversation-id",
  content: "latest user message",
  modelParams: {
    provider: "openai",
    model: "gpt-4o-mini",
    adapter: LLMAdapter.OpenAI,
    temperature: 0.1,
    max_tokens: 128,
    top_p: 1,
  },
};

const parsedConnection = {
  secretKey: "encrypted-secret",
  extraHeaders: null,
  baseURL: null,
  config: null,
};

function buildRequest(body = baseBody): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function createTextStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

function createBytesStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

function createErroredStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("partial"));
      controller.error(new Error("stream failure"));
    },
  });
}

async function waitFor(
  assertion: () => void | Promise<void>,
  timeoutMs: number = 1_000,
) {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError;
}

describe("assistantCompletionHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthorizeRequestOrThrow.mockResolvedValue({ userId: "user-id" });
    mockConversationFindFirst.mockResolvedValue({
      id: baseBody.conversationId,
      userId: "user-id",
      projectId: baseBody.projectId,
    });
    mockLlmApiKeysFindFirst.mockResolvedValue({
      id: "llm-key-id",
      provider: "openai",
      secretKey: "encrypted-secret",
    });
    mockLlmApiKeySafeParse.mockReturnValue({
      success: true,
      data: parsedConnection,
    });
    mockGetConversationMessagesForLLM.mockResolvedValue([
      {
        type: "user",
        role: "user",
        content: "latest user message",
      },
    ]);
    mockCreateMessage.mockResolvedValue({ id: "message-id" });
    mockFetchLLMCompletion.mockResolvedValue(
      createTextStream(["assistant response"]),
    );
  });

  afterEach(async () => {
    // Wait for any async streaming/persistence operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it("persists user message before loading full history and sends that history to the LLM", async () => {
    const llmMessages = [
      { type: "user", role: "user", content: "older user message" },
      { type: "assistant-text", role: "assistant", content: "older reply" },
      { type: "user", role: "user", content: baseBody.content },
    ];
    mockGetConversationMessagesForLLM.mockResolvedValueOnce(llmMessages);

    const response = await assistantCompletionHandler(buildRequest());

    expect(response.status).toBe(200);
    expect(mockCreateMessage).toHaveBeenNthCalledWith(1, {
      conversationId: baseBody.conversationId,
      sender: ConversationMessageSender.USER,
      content: baseBody.content,
    });
    expect(mockConversationFindFirst).toHaveBeenCalledWith({
      where: {
        id: baseBody.conversationId,
        userId: "user-id",
        projectId: baseBody.projectId,
      },
    });
    expect(mockGetConversationMessagesForLLM).toHaveBeenCalledWith({
      conversationId: baseBody.conversationId,
    });
    expect(mockCreateMessage.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetConversationMessagesForLLM.mock.invocationCallOrder[0],
    );
    expect(mockFetchLLMCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: llmMessages,
        streaming: true,
      }),
    );
  });

  it("does not persist user message when no API key exists", async () => {
    mockLlmApiKeysFindFirst.mockResolvedValueOnce(null);

    const response = await assistantCompletionHandler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: "InvalidRequestError",
    });
    expect(mockCreateMessage).not.toHaveBeenCalled();
    expect(mockGetConversationMessagesForLLM).not.toHaveBeenCalled();
    expect(mockFetchLLMCompletion).not.toHaveBeenCalled();
  });

  it("does not persist user message when API key parsing fails", async () => {
    mockLlmApiKeySafeParse.mockReturnValueOnce({
      success: false,
      error: { message: "invalid key shape" },
    });

    const response = await assistantCompletionHandler(buildRequest());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: "InvalidRequestError",
    });
    expect(mockCreateMessage).not.toHaveBeenCalled();
    expect(mockGetConversationMessagesForLLM).not.toHaveBeenCalled();
    expect(mockFetchLLMCompletion).not.toHaveBeenCalled();
  });

  it("persists exactly one final assistant message after successful streaming", async () => {
    mockFetchLLMCompletion.mockResolvedValueOnce(
      createTextStream(["Hello", " world"]),
    );

    const response = await assistantCompletionHandler(buildRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hello world");

    await waitFor(() => {
      expect(mockCreateMessage).toHaveBeenCalledTimes(2);
    });

    const assistantCalls = mockCreateMessage.mock.calls
      .map(([args]) => args)
      .filter((args) => args.sender === ConversationMessageSender.ASSISTANT);

    expect(assistantCalls).toHaveLength(1);
    expect(assistantCalls[0]).toMatchObject({
      conversationId: baseBody.conversationId,
      sender: ConversationMessageSender.ASSISTANT,
      content: "Hello world",
    });
  });

  it("does not create assistant message when the stream is empty", async () => {
    mockFetchLLMCompletion.mockResolvedValueOnce(createTextStream([]));

    const response = await assistantCompletionHandler(buildRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");

    await new Promise((resolve) => setTimeout(resolve, 50));

    const assistantCalls = mockCreateMessage.mock.calls
      .map(([args]) => args)
      .filter((args) => args.sender === ConversationMessageSender.ASSISTANT);

    expect(assistantCalls).toHaveLength(0);
  });

  it("does not persist partial assistant output when streaming errors", async () => {
    mockFetchLLMCompletion.mockResolvedValueOnce(createErroredStream());

    const response = await assistantCompletionHandler(buildRequest());

    expect(response.status).toBe(200);

    await waitFor(() => {
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to capture assistant response",
        expect.any(Error),
      );
    });

    const assistantCalls = mockCreateMessage.mock.calls
      .map(([args]) => args)
      .filter((args) => args.sender === ConversationMessageSender.ASSISTANT);

    expect(assistantCalls).toHaveLength(0);
  });

  it("persists UTF-8 multibyte output split across chunks", async () => {
    const emojiBytes = encoder.encode("😀");
    mockFetchLLMCompletion.mockResolvedValueOnce(
      createBytesStream([
        encoder.encode("Hola "),
        emojiBytes.slice(0, 2),
        emojiBytes.slice(2),
        encoder.encode(" mundo"),
      ]),
    );

    const response = await assistantCompletionHandler(buildRequest());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Hola 😀 mundo");

    await waitFor(() => {
      expect(mockCreateMessage).toHaveBeenCalledTimes(2);
    });

    const assistantCall = mockCreateMessage.mock.calls
      .map(([args]) => args)
      .find((args) => args.sender === ConversationMessageSender.ASSISTANT);

    expect(assistantCall).toBeDefined();
    expect(assistantCall.content).toBe("Hola 😀 mundo");
  });
});
