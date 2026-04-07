import { router, publicProcedure, healthInputSchema } from "./trpc";

export const appRouter = router({
  health: publicProcedure.input(healthInputSchema).query(({ input }) => {
    return {
      ok: true,
      name: input?.name ?? null,
      ts: new Date().toISOString(),
    };
  }),
});

export type AppRouter = typeof appRouter;

