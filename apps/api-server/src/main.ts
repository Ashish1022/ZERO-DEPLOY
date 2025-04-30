import express from 'express';
import { generateSlug } from 'random-word-slugs';
import { RunTaskCommand } from '@aws-sdk/client-ecs';
import { ecsClient } from '@packages/aws/ecs-client';

const port = process.env.API_SERVER_PORT || 9000;

const app = express();

app.post('/project', async (req, res) => {
    const { gitUrl } = req.body;
    if (!gitUrl) return res.status(400).json({ error: "GitHub Repository URL required!" });
    const projectSlug = generateSlug();

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
                        { name: 'GIT_REPOSITORY_URL', value: gitUrl },
                        { name: 'PROJECT_ID', value: projectSlug },
                    ]
                },
            ],
        },
    });
    await ecsClient.send(command);
    return res.json({ status: 'queued', data: { projectSlug }, url: `http://${projectSlug}.localhost:8000` });
});

const server = app.listen(port, () => {
    console.log(`API Server listening at port ${port}`);
});
server.on("error", (err) => {
    console.log("Server Error: ", err);
});
