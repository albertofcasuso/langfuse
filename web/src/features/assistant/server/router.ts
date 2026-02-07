import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import { AssistantPingInput } from "@/src/features/assistant/validation";
import {
  createTRPCRouter,
  protectedProjectProcedure,
} from "@/src/server/api/trpc";

export const assistantRouter = createTRPCRouter({
  ping: protectedProjectProcedure
    .input(AssistantPingInput)
    .query(({ input, ctx }) => {
      throwIfNoProjectAccess({
        session: ctx.session,
        projectId: input.projectId,
        scope: "project:read",
      });

      return { ok: true };
    }),
});
