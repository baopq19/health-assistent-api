import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { prisma } from "./db/prisma";

export type TrpcContext = {
  prisma: typeof prisma;
};

export function createContext(): TrpcContext {
  return { prisma };
}

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const healthInputSchema = z
  .object({
    name: z.string().min(1).optional(),
  })
  .optional();

