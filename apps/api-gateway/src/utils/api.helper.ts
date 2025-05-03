import { RunTaskCommand } from "@aws-sdk/client-ecs";

export const runECSCommand = ({ gitUrl, projectId }: { gitUrl: string; projectId: string }) => {
    return new RunTaskCommand({
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
                        { name: 'PROJECT_ID', value: projectId },
                    ]
                },
            ],
        },
    })
}