import express from 'express';
import httpProxy from 'http-proxy';

const port = process.env.S3_REVERSE_PROXY_PORT || 8000;

const app = express();
const proxy = httpProxy.createProxy();

app.use((req, res) => {
  const hostname = req.hostname;
  const subdomain = hostname.split('.')[0];

  // TODO: Custom domain support
  const BASE_PATH = process.env.AWS_S3_BUCKET_OUTPUT_PATH;
  const resolvesTo = `${BASE_PATH}/${subdomain}`;

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on('proxyReq', (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") proxyReq.path += 'index.html';
});

const server = app.listen(port, () => {
  console.log(`Reverse proxy listening at port ${port}`);
});
server.on("error", (err) => {
  console.log("Server Error: ", err);
});
