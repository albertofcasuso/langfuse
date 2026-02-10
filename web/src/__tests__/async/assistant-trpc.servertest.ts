/** @jest-environment node */

import { randomUUID } from "crypto";
import type { Session } from "next-auth";

import { appRouter } from "@/src/server/api/root";
import { createInnerTRPCContext } from "@/src/server/api/trpc";
import { prisma, Role } from "@langfuse/shared/src/db";

type SeededContext = {
  caller: ReturnType<typeof appRouter.createCaller>;
  orgId: string;
  projectId: string;
  userId: string;
};

type SeededContextParams = {
  projectRole?: Role;
};

function buildSession({
  orgId,
  orgName,
  projectId,
  projectName,
  userId,
  projectRole,
}: {
  orgId: string;
  orgName: string;
  projectId: string;
  projectName: string;
  userId: string;
  projectRole: Role;
}): Session {
  return {
    expires: "1",
    user: {
      id: userId,
      canCreateOrganizations: true,
      name: `assistant-user-${userId.slice(0, 8)}`,
      organizations: [
        {
          id: orgId,
          name: orgName,
          role: "OWNER",
          plan: "cloud:hobby",
          cloudConfig: undefined,
          metadata: {},
          aiFeaturesEnabled: false,
          projects: [
            {
              id: projectId,
              role: projectRole,
              retentionDays: 30,
              deletedAt: null,
              name: projectName,
              metadata: {},
            },
          ],
        },
      ],
      featureFlags: {
        excludeClickhouseRead: false,
        templateFlag: true,
      },
      admin: false,
    },
    environment: {
      enableExperimentalFeatures: false,
      selfHostedInstancePlan: "cloud:hobby",
    },
  };
}

async function seedContext(
  params: SeededContextParams = {},
): Promise<SeededContext> {
  const orgId = randomUUID();
  const projectId = randomUUID();
  const userId = randomUUID();
  const orgName = `assistant-org-${orgId.slice(0, 8)}`;
  const projectName = `assistant-project-${projectId.slice(0, 8)}`;

  await prisma.organization.create({
    data: {
      id: orgId,
      name: orgName,
    },
  });

  await prisma.project.create({
    data: {
      id: projectId,
      orgId,
      name: projectName,
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      name: `assistant-user-${userId.slice(0, 8)}`,
      email: `assistant-${userId}@test.local`,
    },
  });

  const session = buildSession({
    orgId,
    orgName,
    projectId,
    projectName,
    userId,
    projectRole: params.projectRole ?? Role.ADMIN,
  });

  const ctx = createInnerTRPCContext({ session, headers: {} });

  return {
    caller: appRouter.createCaller({ ...ctx, prisma }),
    orgId,
    projectId,
    userId,
  };
}

async function cleanupContext({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}) {
  await prisma.organization.deleteMany({
    where: { id: orgId },
  });
  await prisma.user.deleteMany({
    where: { id: userId },
  });
}

describe("assistant router", () => {
  it("listConversations returns only user/project conversations in descending startedAt order", async () => {
    const context = await seedContext();
    const secondUserId = randomUUID();
    const secondProjectId = randomUUID();

    try {
      await prisma.user.create({
        data: {
          id: secondUserId,
          name: `assistant-user-${secondUserId.slice(0, 8)}`,
          email: `assistant-${secondUserId}@test.local`,
        },
      });

      await prisma.project.create({
        data: {
          id: secondProjectId,
          orgId: context.orgId,
          name: `assistant-project-${secondProjectId.slice(0, 8)}`,
        },
      });

      const olderConversation = await prisma.conversation.create({
        data: {
          userId: context.userId,
          projectId: context.projectId,
          startedAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      });

      const newerConversation = await prisma.conversation.create({
        data: {
          userId: context.userId,
          projectId: context.projectId,
          startedAt: new Date("2026-02-02T00:00:00.000Z"),
        },
      });

      await prisma.conversation.createMany({
        data: [
          {
            id: randomUUID(),
            userId: secondUserId,
            projectId: context.projectId,
            startedAt: new Date("2026-02-03T00:00:00.000Z"),
          },
          {
            id: randomUUID(),
            userId: context.userId,
            projectId: secondProjectId,
            startedAt: new Date("2026-02-04T00:00:00.000Z"),
          },
        ],
      });

      const result = await context.caller.assistant.listConversations({
        projectId: context.projectId,
      });

      expect(result.map((conversation) => conversation.id)).toEqual([
        newerConversation.id,
        olderConversation.id,
      ]);
    } finally {
      await prisma.user.deleteMany({ where: { id: secondUserId } });
      await prisma.project.deleteMany({ where: { id: secondProjectId } });
      await cleanupContext(context);
    }
  });

  it("getConversation returns only owned conversation and messages sorted by timestamp", async () => {
    const context = await seedContext();
    const otherUserId = randomUUID();

    try {
      await prisma.user.create({
        data: {
          id: otherUserId,
          name: `assistant-user-${otherUserId.slice(0, 8)}`,
          email: `assistant-${otherUserId}@test.local`,
        },
      });

      const conversation = await prisma.conversation.create({
        data: {
          userId: context.userId,
          projectId: context.projectId,
          startedAt: new Date("2026-02-05T00:00:00.000Z"),
        },
      });

      const hiddenConversation = await prisma.conversation.create({
        data: {
          userId: otherUserId,
          projectId: context.projectId,
        },
      });

      await prisma.message.createMany({
        data: [
          {
            id: randomUUID(),
            conversationId: conversation.id,
            sender: "ASSISTANT",
            content: "second",
            timestamp: new Date("2026-02-05T00:00:02.000Z"),
          },
          {
            id: randomUUID(),
            conversationId: conversation.id,
            sender: "USER",
            content: "first",
            timestamp: new Date("2026-02-05T00:00:01.000Z"),
          },
          {
            id: randomUUID(),
            conversationId: hiddenConversation.id,
            sender: "USER",
            content: "hidden",
            timestamp: new Date("2026-02-05T00:00:01.000Z"),
          },
        ],
      });

      const result = await context.caller.assistant.getConversation({
        projectId: context.projectId,
        conversationId: conversation.id,
      });

      expect(result.id).toBe(conversation.id);
      expect(result.messages.map((message) => message.content)).toEqual([
        "first",
        "second",
      ]);
    } finally {
      await prisma.user.deleteMany({ where: { id: otherUserId } });
      await cleanupContext(context);
    }
  });

  it("getConversation throws NOT_FOUND when conversation is not owned by session user", async () => {
    const context = await seedContext();
    const otherUserId = randomUUID();

    try {
      await prisma.user.create({
        data: {
          id: otherUserId,
          name: `assistant-user-${otherUserId.slice(0, 8)}`,
          email: `assistant-${otherUserId}@test.local`,
        },
      });

      const notOwnedConversation = await prisma.conversation.create({
        data: {
          userId: otherUserId,
          projectId: context.projectId,
        },
      });

      await expect(
        context.caller.assistant.getConversation({
          projectId: context.projectId,
          conversationId: notOwnedConversation.id,
        }),
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    } finally {
      await prisma.user.deleteMany({ where: { id: otherUserId } });
      await cleanupContext(context);
    }
  });

  it("createConversation persists a conversation for the authenticated user and project", async () => {
    const context = await seedContext();

    try {
      const result = await context.caller.assistant.createConversation({
        projectId: context.projectId,
      });

      const storedConversation = await prisma.conversation.findUnique({
        where: { id: result.id },
      });

      expect(storedConversation).toMatchObject({
        id: result.id,
        userId: context.userId,
        projectId: context.projectId,
      });
    } finally {
      await cleanupContext(context);
    }
  });

  it("enforces project:read scope and throws FORBIDDEN for NONE role", async () => {
    const context = await seedContext({ projectRole: Role.NONE });

    try {
      await expect(
        context.caller.assistant.listConversations({
          projectId: context.projectId,
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    } finally {
      await cleanupContext(context);
    }
  });
});
