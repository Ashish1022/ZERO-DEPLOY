import z from 'zod';
import {
    Request,
    Response,
    NextFunction,
} from 'express';
import { desc, eq } from 'drizzle-orm'

import { client, runECSTask } from '../helpers/api.helper';

import { db } from '@zero-deploy/database'
import { deployment, envVar, project } from '@zero-deploy/database/schema'

export const deployProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            projectId: z.string().min(1, "Project ID is required"),
        });

        const safeParseResult = schema.safeParse(req.body);
        if (!safeParseResult.success) {
            return next(new Error(safeParseResult.error.issues[0]?.message || "Validation failed"));
        }

        const { projectId } = safeParseResult.data;

        const [deploymentProject] = await db
            .select()
            .from(project)
            .where(eq(project.id, projectId))
            .limit(1);

        if (!deploymentProject) {
            return next(new Error("Project not found"));
        }

        const [existingDeployment] = await db
            .select()
            .from(deployment)
            .where(eq(deployment.projectId, projectId))
            .orderBy(desc(deployment.createdAt))
            .limit(1);

        if (existingDeployment?.status === 'IN_PROGRESS') {
            return next(new Error("Previous deployment in progress"));
        }
        if (existingDeployment?.status === 'QUEUED') {
            return next(new Error("Previous deployment already in queue"));
        }

        const [newDeployment] = await db
            .insert(deployment)
            .values({
                projectId: projectId,
                status: 'QUEUED'
            })
            .returning();

        if (!newDeployment) throw new Error("Failed to create deployment");

        const envVars = await db
            .select({ key: envVar.key, value: envVar.value })
            .from(envVar)
            .where(eq(envVar.projectId, projectId));

        let result;
        try {
            await runECSTask({
                projectId: projectId,
                deploymentId: newDeployment.id,
                gitUrl: deploymentProject.gitUrl,
                installCommand: deploymentProject.installCommand,
                buildCommand: deploymentProject.buildCommand,
                outputDir: deploymentProject.outputDir,
                rootDir: deploymentProject.rootDir,
                envVars,
            });

            const [updatedDeployment] = await db
                .update(deployment)
                .set({ status: 'IN_PROGRESS' })
                .where(eq(deployment.id, newDeployment.id))
                .returning();

            result = updatedDeployment;
        } catch (ecsError) {
            await db
                .update(deployment)
                .set({ status: 'FAILED' })
                .where(eq(deployment.id, newDeployment.id));

            throw ecsError;
        }

        res.json({
            status: 'success',
            message: 'Deployment initiated',
            data: { deployment: result },
            url: `http://${deploymentProject.subdomain}.localhost:8000`
        });

    } catch (error) {
        return next(error);
    }
}

export const getLogs = async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id;
    try {
        const logs = await client.query({
            query: 'SELECT event_id, deployment_id, log, timestamp FROM log_events WHERE deployment_id = {deployment_id:String} ORDER BY timestamp',
            query_params: {
                deployment_id: id,
            },
            format: 'JSONEachRow'
        });
        const rawLogs = await logs.json();
        res.json({ logs: rawLogs });
    } catch (error: any) {
        if (typeof error?.message === 'string' && /doesn't exist|UNKNOWN_TABLE/i.test(error.message)) {
            res.json({ logs: [] });
            return;
        }
        return next(error);
    }
}