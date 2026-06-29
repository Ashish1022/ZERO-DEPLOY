import fs from 'fs';
import path from 'path';
import { Kafka } from 'kafkajs';
import {v4 as uuidv4} from 'uuid';

import { createClient } from '@clickhouse/client'
import { RunTaskCommand, ECSClient } from "@aws-sdk/client-ecs";

export const ecsClient = new ECSClient({
    region: process.env.AWS_REGION as string,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
    },
});

export const runECSTask = async ({
    gitUrl,
    projectId,
    deploymentId,
    installCommand,
    buildCommand,
    outputDir,
    rootDir,
    envVars,
}: {
    gitUrl: string;
    projectId: string;
    deploymentId: string;
    installCommand?: string | null;
    buildCommand?: string | null;
    outputDir?: string | null;
    rootDir?: string | null;
    envVars?: { key: string; value: string }[];
}) => {
    const command = new RunTaskCommand({
        cluster: process.env.AWS_ECS_CLUSTER as string,
        taskDefinition: process.env.AWS_TASK_DEFINITION as string,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                subnets: [
                    process.env.AWS_SUBNET_ONE as string,
                    process.env.AWS_SUBNET_TWO as string,
                    process.env.AWS_SUBNET_THREE as string
                ],
                securityGroups: [process.env.AWS_SECURITY_GROUP as string],
                assignPublicIp: 'ENABLED',
            },
        },
        overrides: {
            containerOverrides: [
                {
                    name: process.env.AWS_CONTAINER_NAME as string,
                    environment: [
                        { name: 'GIT_REPOSITORY_URL', value: gitUrl },
                        { name: 'PROJECT_ID', value: projectId },
                        { name: 'DEPLOYMENT_ID', value: deploymentId },
                        { name: 'INSTALL_COMMAND', value: installCommand || 'npm install' },
                        { name: 'BUILD_COMMAND', value: buildCommand || 'npm run build' },
                        { name: 'OUTPUT_DIR', value: outputDir || 'dist' },
                        { name: 'ROOT_DIR', value: rootDir || '/' },
                        { name: 'PROJECT_ENV', value: JSON.stringify(envVars ?? []) },
                        { name: 'KAFKA_BROKER', value: process.env.KAFKA_BROKER ?? '' },
                        { name: 'KAFKA_USERNAME', value: process.env.KAFKA_USERNAME ?? '' },
                        { name: 'KAFKA_PASSWORD', value: process.env.KAFKA_PASSWORD ?? '' },
                        { name: 'AWS_REGION', value: process.env.AWS_REGION ?? 'ap-south-1' },
                        { name: 'AWS_ACCESS_KEY_ID', value: process.env.AWS_ACCESS_KEY_ID ?? '' },
                        { name: 'AWS_SECRET_ACCESS_KEY', value: process.env.AWS_SECRET_ACCESS_KEY ?? '' },
                        { name: 'AWS_S3_BUCKET', value: process.env.AWS_S3_BUCKET ?? '' },
                    ]
                },
            ],
        },
    });

    const response = await ecsClient.send(command);
    return response;
}

export const client = createClient({
    database: process.env.CLICKHOUSE_DATABASE || 'default',
    username: process.env.CLICKHOUSE_USERNAME,
    password: process.env.CLICKHOUSE_PASSWORD,
    url: process.env.CLICKHOUSE_URL,
})

export async function ensureClickHouseSchema() {
    await client.command({
        query: `
            CREATE TABLE IF NOT EXISTS log_events (
                event_id      String,
                deployment_id String,
                log           String,
                timestamp     DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            ORDER BY (deployment_id, timestamp)
        `,
    });
}

const kafkaCertPath = path.join(__dirname, '../../kafka.pem');

export const kafka = new Kafka({
    clientId: `api-server`,
    brokers: [process.env.KAFKA_BROKER as string],
    ...(process.env.KAFKA_USERNAME
        ? {
            sasl: {
                username: process.env.KAFKA_USERNAME as string,
                password: process.env.KAFKA_PASSWORD as string,
                mechanism: 'plain',
            },
            ssl: fs.existsSync(kafkaCertPath)
                ? { ca: [fs.readFileSync(kafkaCertPath, 'utf-8')] }
                : true,
        }
        : {}),
});

export const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' });

export function notifyLogSubscribers(deploymentId: string, log: string) {
    import('../index').then(({ logSubscribers }) => {
        const subs = logSubscribers.get(deploymentId);
        if (!subs?.size) return;
        const payload = JSON.stringify({ type: 'log', deploymentId, log, timestamp: new Date().toISOString() });
        for (const ws of subs) {
            if (ws.readyState === 1) {
                ws.send(payload);
            }
        }
    }).catch(() => {});
}

export async function initKafkaConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topics: ['container-logs'] })

    await consumer.run({
        autoCommit: false,
        eachBatch: async function ({ batch, heartbeat, resolveOffset, commitOffsetsIfNecessary }) {
            const messages = batch.messages;
            console.log(`Received ${messages.length} messages...`);
            for (const message of messages) {
                const stringMessage = message.value?.toString();
                if (!stringMessage) return;
                const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(stringMessage);
                await client.insert({
                    table: 'log_events',
                    values: [{ event_id: uuidv4(), deployment_id: DEPLOYMENT_ID, log }],
                    format: 'JSONEachRow'
                });
                notifyLogSubscribers(DEPLOYMENT_ID, log);
                commitOffsetsIfNecessary();
                await resolveOffset(message.offset);
                await heartbeat();
            }
        }
    })
}