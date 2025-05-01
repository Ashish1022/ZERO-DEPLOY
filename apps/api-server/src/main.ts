import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import router from './routes/api.router';
import { errorMiddleware } from '@packages/error-handler/error-middleware';

const port = process.env.API_SERVER_PORT || 9000;

const app = express();

app.use(
  cors({
    origin: ["*"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/api', router);
app.use(errorMiddleware);

const server = app.listen(port, () => {
  console.log(`API Server listening at port ${port}`);
});
server.on("error", (err) => {
  console.log("Server Error: ", err);
});
