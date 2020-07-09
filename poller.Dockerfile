FROM node:12 as http-worker
RUN npm install -g nodemon

WORKDIR /http-worker
COPY conductor-poller/ conductor-poller
COPY shared/ shared
COPY package.json .
COPY package-lock.json .
RUN npm install

CMD ["node", "--unhandled-rejections=strict", "conductor-poller/start-conductor-poller.js"]
