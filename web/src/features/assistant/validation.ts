import { z } from "zod/v4";
import { LLMAdapter } from "@langfuse/shared";

// tRPC inputs
export const ListConversationsInput = z.object({
  projectId: z.string(),
});

export const GetConversationInput = z.object({
  projectId: z.string(),
  conversationId: z.string(),
});

export const CreateConversationInput = z.object({
  projectId: z.string(),
});

// App Router body schema for POST /api/assistant
export const SendMessageBody = z.object({
  projectId: z.string(),
  conversationId: z.string(),
  content: z.string().min(1),
  modelParams: z.object({
    provider: z.string(),
    model: z.string(),
    adapter: z.enum(LLMAdapter),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
    top_p: z.number().optional(),
  }),
});

export type SendMessageBodyType = z.infer<typeof SendMessageBody>;
