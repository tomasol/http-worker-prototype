const PROTO_PATH = __dirname + '/http.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const http = require('http');

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

function executeHttp(workerHttpRequest, callback) {
    // prepare request from the data from GRPc call
    let options = {
        host: workerHttpRequest.request.url,
        method: workerHttpRequest.request.method
    };

    //set up callbacks for the http request
    let req = http.request(options, function(res) {
        res.setEncoding('utf8'); //TODO encoding
        let chunks = [];
        res.on('data', function (chunk) {
            chunks.push(Buffer.from(chunk, 'utf8')) //TODO encoding
        });
        res.on('close', function (chunk) {
            callback(null, {output:  Buffer.concat(chunks).toString('utf8'), status: res.statusCode}) //TODO encoding
        });
    });

    req.end(); //send http request
}

let getServer = function () {
    let server = new grpc.Server();
    server.addService(httpproto.HttpWorker.service, {executeHttp: executeHttp});
    return server;
}

const routeServer = getServer();
routeServer.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
routeServer.start();
