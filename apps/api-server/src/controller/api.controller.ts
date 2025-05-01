import { RunTaskCommand } from "@aws-sdk/client-ecs";
import prismadb from "@packages/db/prisma";
import { ValidationError } from "@packages/error-handler";
import { NextFunction, Request, Response } from "express";
import { z } from 'zod';
import { ecsClient } from "../utils/ecs-client";
import { generateSlug } from "random-word-slugs";

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            name: z.string(),
            gitUrl: z.string(),
            subdomain: z.string(),
        });
        const safeParseResult = schema.safeParse(req.body);
        if (safeParseResult.error) return next(new ValidationError("All fields are required."));

        const { name, gitUrl, subdomain } = safeParseResult.data;

        const existingSubdomain = await prismadb.project.findFirst({
            where: {
                subdomain: subdomain
            },
        });
        if (existingSubdomain) return next(new ValidationError("Subdomain Not available!"));

        const project = await prismadb.project.create({
            data: {
                name: name,
                gitUrl: gitUrl,
                subdomain: subdomain || generateSlug(),
            },
        });

        res.status(200).json({
            message: "Success",
            project
        });
    } catch (error) {
        return next(error);
    }
};

export const deployProject = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            projectId: z.string(),
        });
        const safeParseResult = schema.safeParse(req.body);
        if (safeParseResult.error) return next(new ValidationError("All fields are required."));

        const { projectId } = safeParseResult.data;

        const existingDeployment = await prismadb.deployment.findFirst({
            where: {
                projectId: projectId,
            },
        });
        if (existingDeployment?.status === 'IN_PROGRESS') return next(new ValidationError("Previous deployment in progress."));
        if (existingDeployment?.status === 'QUEUED') return next(new ValidationError("Previous deployment already in queue."));

        const deployment = await prismadb.deployment.create({
            data: {
                projectId: projectId,
                status: 'QUEUED',
            },
            include: {
                project: true,
            }
        });

        // TODO: DB integration for the purpose of storing user related and project related data also to check existing slugs.
        // TODO: To implement user given project slug.

        const command = new RunTaskCommand({
            cluster: process.env.AWS_ECS_CLUSTER as string,
            taskDefinition: process.env.AWS_TASK_DEFINITION as string,
            launchType: 'FARGATE',
            count: 1,
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: [process.env.AWS_SUBNET_ONE as string, process.env.AWS_SUBNET_TWO as string, process.env.AWS_SUBNET_THREE as string],
                    securityGroups: [process.env.AWS_SECURITY_GROUP as string],
                    assignPublicIp: 'ENABLED',
                },
            },
            overrides: {
                containerOverrides: [
                    {
                        name: process.env.AWS_ECR_IMAGE as string,
                        environment: [
                            { name: 'GIT_REPOSITORY_URL', value: deployment.project.gitUrl },
                            { name: 'PROJECT_ID', value: projectId },
                        ]
                    },
                ],
            },
        });

        await ecsClient.send(command);

        return res.json({ status: 'queued', data: { deployment }, url: `http://${deployment.project.subdomain}.localhost:8000` });
    } catch (error) {
        return next(error);
    }
}