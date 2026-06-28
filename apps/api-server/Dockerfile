FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y curl wget git build-essential && rm -rf /var/lib/apt/lists/*

RUN curl -fsSl https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs

RUN npm install -g pnpm 
RUN npm install -g typescript

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml .
COPY tsconfig.json .
COPY .env ./

RUN pnpm install

COPY . .

RUN pnpm build

EXPOSE 3000

CMD [ "pnpm", "start" ]