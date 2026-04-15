import { z } from "zod";
import { authedProcedure, router } from "../trpc";
import { generateChatReply } from "../ai/chatService";

const messageContentSchema = z.string().min(1).max(16_000);

export const chatRouter = router({
  createThread: authedProcedure
    .input(
      z
        .object({
          title: z.string().min(1).max(200).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const thread = await ctx.prisma.chatThread.create({
        data: {
          userId: ctx.userId,
          title: input?.title,
        },
      });
      return { thread };
    }),

  listThreads: authedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(50).optional(),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const threads = await ctx.prisma.chatThread.findMany({
        where: { userId: ctx.userId, archivedAt: null },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(input?.cursor
          ? {
              cursor: { id: input.cursor },
              skip: 1,
            }
          : {}),
        select: {
          id: true,
          title: true,
          lastMessageAt: true,
          lastMessagePreview: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const nextCursor = threads.length > limit ? threads[limit]!.id : null;
      return { threads: threads.slice(0, limit), nextCursor };
    }),

  getThread: authedProcedure
    .input(
      z.object({
        threadId: z.string().min(1),
        messageLimit: z.number().int().min(1).max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const messageLimit = input.messageLimit ?? 50;
      const thread = await ctx.prisma.chatThread.findFirstOrThrow({
        where: { id: input.threadId, userId: ctx.userId },
        select: {
          id: true,
          title: true,
          lastMessageAt: true,
          lastMessagePreview: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: messageLimit,
            select: {
              id: true,
              role: true,
              content: true,
              model: true,
              createdAt: true,
            },
          },
        },
      });

      return { thread: { ...thread, messages: thread.messages.slice().reverse() } };
    }),

  sendMessage: authedProcedure
    .input(
      z.object({
        threadId: z.string().min(1).optional(),
        content: messageContentSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const startedAt = Date.now();

      const thread =
        input.threadId != null
          ? await ctx.prisma.chatThread.findFirstOrThrow({
              where: { id: input.threadId, userId: ctx.userId },
            })
          : await ctx.prisma.chatThread.create({
              data: { userId: ctx.userId },
            });

      const userMessage = await ctx.prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          userId: ctx.userId,
          role: "USER",
          content: input.content,
        },
        select: { id: true, role: true, content: true, createdAt: true },
      });

      const recent = await ctx.prisma.chatMessage.findMany({
        where: { threadId: thread.id, userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { role: true, content: true },
      });

      const { content: assistantContent, model } = await generateChatReply({
        messages: recent.slice().reverse(),
      });

      const assistantMessage = await ctx.prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          userId: ctx.userId,
          role: "ASSISTANT",
          content: assistantContent,
          model,
          latencyMs: Date.now() - startedAt,
        },
        select: { id: true, role: true, content: true, model: true, createdAt: true },
      });

      const preview = assistantContent.slice(0, 240);
      const updatedThread = await ctx.prisma.chatThread.update({
        where: { id: thread.id },
        data: {
          lastMessageAt: assistantMessage.createdAt,
          lastMessagePreview: preview,
        },
        select: {
          id: true,
          title: true,
          lastMessageAt: true,
          lastMessagePreview: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { thread: updatedThread, userMessage, assistantMessage };
    }),
});

