import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';

import { project } from "@zero-deploy/database/schema";
import { baseProcedure, createTRPCRouter } from "@/init";

export const apiServeRouter = createTRPCRouter({
    checkExistingSubdomin: baseProcedure
        .input(
            z.object({
                subdomain: z.string()
            })
        )
        .query(async ({ ctx, input }) => {

            const { subdomain } = input

            const [exisintgSubdomain] = await ctx.db
                .select()
                .from(project)
                .where(eq(project.subdomain, subdomain))
        })
})