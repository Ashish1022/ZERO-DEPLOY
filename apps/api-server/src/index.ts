import './env';

import http from 'http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

import router from './router/api.router';
import { ensureClickHouseSchema, initKafkaConsumer, notifyLogSubscribers } from './helpers/api.helper';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/', router);

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

export const logSubscribers = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws, req) => {
    const deploymentId = (req as any).__deploymentId as string;

    if (!deploymentId) {
        ws.close(1008, 'Missing deployment ID');
        return;
    }

    if (!logSubscribers.has(deploymentId)) {
        logSubscribers.set(deploymentId, new Set());
    }
    logSubscribers.get(deploymentId)!.add(ws);

    ws.on('close', () => {
        logSubscribers.get(deploymentId)?.delete(ws);
        if (logSubscribers.get(deploymentId)?.size === 0) {
            logSubscribers.delete(deploymentId);
        }
    });

    ws.send(JSON.stringify({ type: 'connected', deploymentId }));
});

server.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    const match = url.match(/^\/logs\/([a-f0-9-]{36})$/);

    if (!match) {
        socket.destroy();
        return;
    }

    (req as any).__deploymentId = match[1];

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

const port = process.env.PORT;

async function start() {
    await ensureClickHouseSchema();
    await initKafkaConsumer();

    server.listen(port, () => {
        console.log(`API server listening at http://localhost:${port}`);
        console.log(`WebSocket log stream at ws://localhost:${port}/logs/:deploymentId`);
    });
    server.on('error', console.error);
}

start().catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
});
