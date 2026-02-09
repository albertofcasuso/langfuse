/** @jest-environment node */

jest.mock("@langfuse/shared/src/db", () => ({
  prisma: {
    conversation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from "@langfuse/shared/src/db";
import {
  listConversations,
  getConversation,
  createConversation,
} from "../features/assistant/server/service";

const mockConversationFindMany = prisma.conversation.findMany as jest.Mock;
const mockConversationFindFirst = prisma.conversation.findFirst as jest.Mock;
const mockConversationCreate = prisma.conversation.create as jest.Mock;

describe("assistant service conversation methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists conversations for a user and project ordered by newest first", async () => {
    const expectedConversations = [
      { id: "conv-2", startedAt: new Date("2026-02-01T00:00:00.000Z") },
      { id: "conv-1", startedAt: new Date("2026-01-01T00:00:00.000Z") },
    ];
    mockConversationFindMany.mockResolvedValueOnce(expectedConversations);

    const result = await listConversations({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(mockConversationFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1", projectId: "project-1" },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
      },
    });
    expect(result).toEqual(expectedConversations);
  });

  it("gets a conversation with its messages ordered chronologically", async () => {
    const expectedConversation = {
      id: "conv-1",
      messages: [
        { id: "msg-1", timestamp: new Date("2026-02-01T00:00:00.000Z") },
        { id: "msg-2", timestamp: new Date("2026-02-01T00:01:00.000Z") },
      ],
    };
    mockConversationFindFirst.mockResolvedValueOnce(expectedConversation);

    const result = await getConversation({
      conversationId: "conv-1",
      userId: "user-1",
      projectId: "project-1",
    });

    expect(mockConversationFindFirst).toHaveBeenCalledWith({
      where: { id: "conv-1", userId: "user-1", projectId: "project-1" },
      include: {
        messages: {
          orderBy: { timestamp: "asc" },
        },
      },
    });
    expect(result).toEqual(expectedConversation);
  });

  it("creates a conversation and returns only its id", async () => {
    const expectedConversation = { id: "conv-new" };
    mockConversationCreate.mockResolvedValueOnce(expectedConversation);

    const result = await createConversation({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(mockConversationCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", projectId: "project-1" },
      select: { id: true },
    });
    expect(result).toEqual(expectedConversation);
  });
});
