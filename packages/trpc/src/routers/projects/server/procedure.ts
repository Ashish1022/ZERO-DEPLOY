import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

import { project, deployment, envVar, domain } from '@zero-deploy/database/schema';
import { createTRPCRouter, protectedProcedure } from '../../../init';

const projectCreateSchema = z.object({
  name: z.string().min(1).max(100),
  gitUrl: z.string().url('Invalid Git URL'),
  subdomain: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase letters, numbers, or hyphens'),
  framework: z.string().optional(),
  rootDir: z.string().default('/'),
  buildCommand: z.string().optional(),
  outputDir: z.string().optional(),
  installCommand: z.string().optional(),
});

export const projectsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.db
      .select({
        id: project.id,
        name: project.name,
        gitUrl: project.gitUrl,
        subdomain: project.subdomain,
        framework: project.framework,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })
      .from(project)
      .where(eq(project.userId, ctx.user.id))
      .orderBy(desc(project.updatedAt));

    return projects;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db
        .select()
        .from(project)
        .where(and(eq(project.id, input.id), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!p) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      return p;
    }),

  checkSubdomain: protectedProcedure
    .input(z.object({ subdomain: z.string() }))
    .query(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.subdomain, input.subdomain))
        .limit(1);

      return { available: !existing };
    }),

  create: protectedProcedure
    .input(projectCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.subdomain, input.subdomain))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Subdomain already taken' });
      }

      const [newProject] = await ctx.db
        .insert(project)
        .values({
          userId: ctx.user.id,
          name: input.name,
          gitUrl: input.gitUrl,
          subdomain: input.subdomain,
          framework: input.framework,
          rootDir: input.rootDir,
          buildCommand: input.buildCommand,
          outputDir: input.outputDir,
          installCommand: input.installCommand,
        })
        .returning();

      return newProject;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        buildCommand: z.string().optional(),
        outputDir: z.string().optional(),
        installCommand: z.string().optional(),
        rootDir: z.string().optional(),
        framework: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, id), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const [updated] = await ctx.db
        .update(project)
        .set(updates)
        .where(eq(project.id, id))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.id), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      await ctx.db.delete(project).where(eq(project.id, input.id));

      return { success: true };
    }),

  listDeployments: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const deployments = await ctx.db
        .select()
        .from(deployment)
        .where(eq(deployment.projectId, input.projectId))
        .orderBy(desc(deployment.createdAt));

      return deployments;
    }),

  getDeployment: protectedProcedure
    .input(z.object({ deploymentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [d] = await ctx.db
        .select({
          id: deployment.id,
          projectId: deployment.projectId,
          status: deployment.status,
          createdAt: deployment.createdAt,
          updatedAt: deployment.updatedAt,
        })
        .from(deployment)
        .where(eq(deployment.id, input.deploymentId))
        .limit(1);

      if (!d) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Deployment not found' });
      }

      // ownership check via project
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, d.projectId!), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
      }

      return d;
    }),

  deploy: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await ctx.db
        .select()
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!p) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const response = await fetch(
        `http://13.233.192.101:9001/deploy-project`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: input.projectId }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Deployment failed' }));
        console.log(err.message)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
      }

      const data = await response.json();
      return data;
    }),

  listEnvVars: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const vars = await ctx.db
        .select({ id: envVar.id, key: envVar.key, createdAt: envVar.createdAt })
        .from(envVar)
        .where(eq(envVar.projectId, input.projectId))
        .orderBy(envVar.key);

      return vars;
    }),

  setEnvVar: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        key: z.string().min(1).max(255).regex(/^[A-Z0-9_]+$/, 'Keys must be uppercase with underscores'),
        value: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const [result] = await ctx.db
        .insert(envVar)
        .values({ projectId: input.projectId, key: input.key, value: input.value })
        .onConflictDoUpdate({
          target: [envVar.projectId, envVar.key],
          set: { value: input.value, updatedAt: new Date() },
        })
        .returning({ id: envVar.id, key: envVar.key });

      return result;
    }),

  deleteEnvVar: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      await ctx.db
        .delete(envVar)
        .where(and(eq(envVar.id, input.id), eq(envVar.projectId, input.projectId)));

      return { success: true };
    }),

  listDomains: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      return ctx.db
        .select()
        .from(domain)
        .where(eq(domain.projectId, input.projectId))
        .orderBy(domain.createdAt);
    }),

  addDomain: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        hostname: z
          .string()
          .min(1)
          .max(253)
          .regex(/^[a-z0-9.-]+$/, 'Invalid hostname'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const [existing] = await ctx.db
        .select({ id: domain.id })
        .from(domain)
        .where(eq(domain.hostname, input.hostname))
        .limit(1);

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Domain already in use' });
      }

      const [newDomain] = await ctx.db
        .insert(domain)
        .values({ projectId: input.projectId, hostname: input.hostname })
        .returning();

      return newDomain;
    }),

  removeDomain: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [owned] = await ctx.db
        .select({ id: project.id })
        .from(project)
        .where(and(eq(project.id, input.projectId), eq(project.userId, ctx.user.id)))
        .limit(1);

      if (!owned) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      await ctx.db
        .delete(domain)
        .where(and(eq(domain.id, input.id), eq(domain.projectId, input.projectId)));

      return { success: true };
    }),
});
