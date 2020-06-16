const PROTO_PATH = __dirname + '/http.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const config = require('./config.json');

const environment = process.env.NODE_ENV || 'development';
const workerConfig = config[environment];

const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

const httpproto = protoDescriptor.httpproto;

let sendGrpcRequest = (options, httpPayload, callback) => {
    const client = new httpproto.HttpWorker(workerConfig.httpworker_address,
        grpc.credentials.createInsecure());

    client.executeHttp({requestOptions: JSON.stringify(options), httpPayload: httpPayload}, callback);
}

exports.sendGrpcRequest = sendGrpcRequest;
