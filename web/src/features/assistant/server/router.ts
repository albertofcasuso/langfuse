import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import {
  ListConversationsInput,
  GetConversationInput,
  CreateConversationInput,
} from "@/src/features/assistant/validation";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  listConversations,
  getConversation,
  createConversation,
} from "@/src/features/assistant/server/service";

export const assistantRouter = createTRPCRouter({
  listConversations: protectedProjectProcedure
    .input(ListConversationsInput)
    .query(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "project:read",
      });

      return listConversations({
        userId: ctx.session.user.id,
        projectId: input.projectId,
      });
    }),

  getConversation: protectedProjectProcedure
    .input(GetConversationInput)
    .query(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "project:read",
      });

      const conversation = await getConversation({
        conversationId: input.conversationId,
        userId: ctx.session.user.id,
        projectId: input.projectId,
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      return conversation;
    }),

  createConversation: protectedProjectProcedure
    .input(CreateConversationInput)
    .mutation(async ({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "project:read",
      });

      return createConversation({
        userId: ctx.session.user.id,
        projectId: input.projectId,
      });
    }),
});
