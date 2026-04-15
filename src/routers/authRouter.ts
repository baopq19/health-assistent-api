import { z } from "zod";
import { authedProcedure, publicProcedure, router } from "../trpc";

export const authRouter = router({
  getSession: publicProcedure.query(({ ctx }) => {
    const user = ctx.workosAuth.user
      ? {
          id: ctx.workosAuth.user.id,
          email: ctx.workosAuth.user.email,
          firstName: ctx.workosAuth.user.firstName ?? null,
          lastName: ctx.workosAuth.user.lastName ?? null,
        }
      : null;

    return {
      user,
      workos: {
        organizationId: ctx.workosAuth.user ? ctx.workosAuth.organizationId ?? null : null,
      },
    };
  }),

  registerDeviceToken: authedProcedure
    .input(
      z.object({
        platform: z.enum(["ANDROID", "IOS", "WEB"]),
        token: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.deviceToken.upsert({
        where: { token: input.token },
        update: {
          userId: ctx.userId,
          platform: input.platform,
          isActive: true,
          lastSeenAt: new Date(),
        },
        create: {
          userId: ctx.userId,
          platform: input.platform,
          token: input.token,
          isActive: true,
          lastSeenAt: new Date(),
        },
      });

      return { ok: true };
    }),

  unregisterDeviceToken: authedProcedure
    .input(
      z.object({
        token: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.deviceToken.updateMany({
        where: { token: input.token, userId: ctx.userId },
        data: { isActive: false },
      });
      return { ok: true };
    }),
});

