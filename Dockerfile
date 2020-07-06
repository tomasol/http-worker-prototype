FROM node:12 as http-worker

WORKDIR /http-worker
COPY . .
RUN npm install
CMD ["node","http-worker/httpworker-grpc-server"]

