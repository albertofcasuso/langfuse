import { z } from "zod/v4";

export const AssistantPingInput = z
  .object({
    projectId: z.string(),
  })
  .strict();
