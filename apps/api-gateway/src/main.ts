import express from 'express';
import cors from 'cors';
import router from './router/api.router';

const app = express();

app.use(
  cors({
    origin: ["*"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);
app.use(express.json());
app.use('/', router);

const port = process.env.PORT || 9000;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
