FROM node:12 as http-worker
RUN npm install -g nodemon

WORKDIR /http-worker
COPY http-worker/ http-worker
COPY shared/ shared
COPY package.json .
COPY package-lock.json .
RUN npm install

CMD ["node", "--unhandled-rejections=strict", "http-worker/httpworker-grpc-server"]
