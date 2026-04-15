import { authedProcedure, router } from "../trpc";
import { z } from "zod";

export const dashboardRouter = router({
  getHome: authedProcedure
    .input(
      z
        .object({
          threadsLimit: z.number().int().min(1).max(20).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const threadsLimit = input?.threadsLimit ?? 5;

      const recentThreads = await ctx.prisma.chatThread.findMany({
        where: { userId: ctx.userId, archivedAt: null },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
        take: threadsLimit,
        select: {
          id: true,
          title: true,
          lastMessageAt: true,
          lastMessagePreview: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        recentThreads,
        recentAiAdvice: [],
      };
    }),
});

