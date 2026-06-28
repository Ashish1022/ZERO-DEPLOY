import { createTRPCRouter } from "../init";
import { authRouter } from "./auth/server/procedure";
import { projectsRouter } from "./projects/server/procedure";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  projects: projectsRouter,
});

export type AppRouter = typeof appRouter;
