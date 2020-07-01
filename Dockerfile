FROM node:12 as http-worker

WORKDIR /http-worker
RUN git clone https://github.com/hotlib/http-worker-prototype.git .
RUN npm install
CMD ["node","http-worker/httpworker-grpc-server"]

