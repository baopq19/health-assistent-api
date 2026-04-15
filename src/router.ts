import { router, publicProcedure, healthInputSchema } from "./trpc";
import { authRouter } from "./routers/authRouter";
import { userRouter } from "./routers/userRouter";
import { chatRouter } from "./routers/chatRouter";
import { dashboardRouter } from "./routers/dashboardRouter";

export const appRouter = router({
  health: publicProcedure.input(healthInputSchema).query(({ input }) => {
    return {
      ok: true,
      name: input?.name ?? null,
      ts: new Date().toISOString(),
    };
  }),
  auth: authRouter,
  user: userRouter,
  chat: chatRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;

