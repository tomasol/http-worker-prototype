FROM node:12 as http-worker
RUN npm install -g nodemon

WORKDIR /http-worker
COPY conductor-poller/ conductor-poller
COPY http-worker/ http-worker
COPY shared/ shared
COPY package.json .
COPY package-lock.json .
RUN npm install

