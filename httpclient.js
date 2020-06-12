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


// interface ClientRequestArgs {
//     protocol?: string | null;
//     host?: string | null;
//     hostname?: string | null;
//     family?: number;
//     port?: number | string | null;
//     defaultPort?: number | string;
//     localAddress?: string;
//     socketPath?: string;
//     /**
//      * @default 8192
//      */
//     maxHeaderSize?: number;
//     method?: string;
//     path?: string | null;
//     headers?: OutgoingHttpHeaders;
//     auth?: string | null;
//     agent?: Agent | boolean;
//     _defaultAgent?: Agent;
//     timeout?: number;
//     setHost?: boolean;
//     // https://github.com/nodejs/node/blob/master/lib/_http_client.js#L278
//     createConnection?: (options: ClientRequestArgs, oncreate: (err: Error, socket: Socket) => void) => Socket;
// }


function main() {
    const client = new httpproto.HttpWorker('localhost:50051',
        grpc.credentials.createInsecure());
    let options = {protocol: 'https:', host: 'httpbin.org', path: '/post', method: 'POST', headers: {'Content-Type': 'text/html; charset=UTF8'}}

    client.executeHttp({requestOptions: JSON.stringify(options), httpPayload: 'this is a test msg'}, function(err, response) {
        console.log('Http body data:', response.output);
    });
}

main();