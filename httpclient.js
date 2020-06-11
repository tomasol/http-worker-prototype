const PROTO_PATH = __dirname + '/http.proto';

const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
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

function main() {
    const client = new httpproto.HttpWorker('localhost:50051',
        grpc.credentials.createInsecure());

    client.executeHttp({url: 'www.google.com', payload: 'payload', method: 'GET', headers: 'empty'}, function(err, response) {
        console.log('Http body data:', response.output);
    });
}

main();