import './env';

import cors from 'cors'
import express from 'express'
import { eq } from 'drizzle-orm'
import httpProxy from 'http-proxy'

import { db } from '@zero-deploy/database';
import { project } from '@zero-deploy/database/schema';

const BASE_PATH = process.env.AWS_S3_BUCKET_OUTPUT_PATH;

const app = express()
export const proxy = httpProxy.createProxy();

app.use(cors({
    origin: ["*"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
}));

app.use(async (req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0] || '';

    const [getProject] = await db
        .select()
        .from(project)
        .where(eq(project.subdomain, subdomain))
        .limit(1);

    const resolvesTo = `${BASE_PATH}/${getProject?.id}`;
    proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === "/") proxyReq.path += 'index.html';
});

const port = process.env.S3_PROXY_PORT;
const server = app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
});
server.on('error', console.error);