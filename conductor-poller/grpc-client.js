const PROTO_PATH = __dirname + '/../shared/http.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const config = require('../shared/config.json');

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

/**
 *
 * @param options HTTP options for the "http(s)" nodejs library
 * @param httpPayload body of the request (in case of POST/PUT...)
 */

let sendGrpcRequest = (options, httpPayload, callback) => {
    const client = new httpproto.HttpWorker(workerConfig.httpworker_address,
        grpc.credentials.createInsecure());

    client.executeHttp({requestOptions: JSON.stringify(options), httpPayload: httpPayload}, callback);
}

exports.sendGrpcRequest = sendGrpcRequest;
