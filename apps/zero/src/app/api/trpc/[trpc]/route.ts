import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@zero-deploy/trpc/routers";
import { createTRPCContext } from "@zero-deploy/trpc/init";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error("tRPC error:", error);
      }
    },
  });

export { handler as GET, handler as POST };
