import { cache } from "react";
import superjson from "superjson";
import jwt from "jsonwebtoken";
import { headers as getHeaders } from "next/headers";

import { initTRPC, TRPCError } from "@trpc/server"
import { users } from "@zero-deploy/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@zero-deploy/database";

type Context = {
  db: typeof db;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export const createTRPCContext = cache(async () => {
  const headers = await getHeaders();
  const cookieHeader = headers.get('cookie');

  let user = null;

  if (cookieHeader) {
    const tokenMatch = cookieHeader.match(/zero-deploy-access-token=([^;]+)/);

    if (tokenMatch) {
      try {
        const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET!) as { userId: string };

        const userResult = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(and(
            eq(users.id, decoded.userId),
            isNull(users.deletedAt)
          ))
          .limit(1);

        if (userResult.length > 0) {
          user = userResult[0];
        }
      } catch {
        user = null;
      }
    }
  }

  return {
    db,
    user,
  };
});

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

export const baseProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});