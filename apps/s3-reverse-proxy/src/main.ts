import express from 'express';
import cors from 'cors';
import { proxy } from './utils/proxy';
import prismadb from '../../../packages/utils/db/prisma';

const app = express();

app.use(cors({
  origin: ["*"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: true,
}));

const BASE_PATH = process.env.AWS_S3_BUCKET_OUTPUT_PATH;

app.use(async (req, res) => {
  const hostname = req.hostname;
  const subdomain = hostname.split('.')[0];

  const project = await prismadb.project.findUnique({
    where: {
      subdomain: subdomain
    },
  });

  const resolvesTo = `${BASE_PATH}/${project?.id}`;
  proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
})

proxy.on('proxyReq', (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") proxyReq.path += 'index.html';
});

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
