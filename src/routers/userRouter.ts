import { z } from "zod";
import { authedProcedure, router } from "../trpc";

export const userRouter = router({
  getProfile: authedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    return { user };
  }),

  updateProfile: authedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { name: input.name },
        select: { id: true, email: true, name: true, createdAt: true },
      });
      return { user };
    }),

  getNotificationPreferences: authedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.notificationSettings.findUnique({
      where: { userId: ctx.userId },
    });
    return {
      settings: settings ?? {
        userId: ctx.userId,
        preference: "BOTH" as const,
        timezone: "UTC",
        quietHoursStartMin: null,
        quietHoursEndMin: null,
        reminderDefaultLeadMin: 0,
      },
    };
  }),

  updateNotificationPreferences: authedProcedure
    .input(
      z.object({
        preference: z.enum(["EMAIL_ONLY", "PUSH_ONLY", "BOTH", "NONE"]).optional(),
        timezone: z.string().min(1).optional(),
        quietHoursStartMin: z.number().int().min(0).max(1439).nullable().optional(),
        quietHoursEndMin: z.number().int().min(0).max(1439).nullable().optional(),
        reminderDefaultLeadMin: z.number().int().min(0).max(60 * 24 * 30).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await ctx.prisma.notificationSettings.upsert({
        where: { userId: ctx.userId },
        update: {
          ...(input.preference ? { preference: input.preference } : {}),
          ...(input.timezone ? { timezone: input.timezone } : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "quietHoursStartMin")
            ? { quietHoursStartMin: input.quietHoursStartMin ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(input, "quietHoursEndMin")
            ? { quietHoursEndMin: input.quietHoursEndMin ?? null }
            : {}),
          ...(typeof input.reminderDefaultLeadMin === "number"
            ? { reminderDefaultLeadMin: input.reminderDefaultLeadMin }
            : {}),
        },
        create: {
          userId: ctx.userId,
          preference: input.preference ?? "BOTH",
          timezone: input.timezone ?? "UTC",
          quietHoursStartMin: input.quietHoursStartMin ?? null,
          quietHoursEndMin: input.quietHoursEndMin ?? null,
          reminderDefaultLeadMin: input.reminderDefaultLeadMin ?? 0,
        },
      });

      return { settings };
    }),
});

