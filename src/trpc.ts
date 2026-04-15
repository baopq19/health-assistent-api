import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "./db/prisma";
import type { AuthResult } from "@workos/authkit-session";

export type TrpcContext = {
  prisma: typeof prisma;
  userId: string | null;
  workosAuth: AuthResult;
};

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export const healthInputSchema = z
  .object({
    name: z.string().min(1).optional(),
  })
  .optional();

