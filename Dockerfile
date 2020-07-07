FROM node:12 as http-worker

WORKDIR /http-worker

# install grpc
#RUN apt-get update
#RUN apt-get -y install grpc


COPY . .
RUN npm install
RUN npm rebuild
CMD ["node","http-worker/httpworker-grpc-server"]

