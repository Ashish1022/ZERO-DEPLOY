FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /home/app

COPY package*.json ./
RUN npm install

COPY main.sh script.js kafka.pem ./

RUN chmod +x main.sh

ENTRYPOINT ["/home/app/main.sh"]