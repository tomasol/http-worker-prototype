const PROTO_PATH = __dirname + '/http.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const http = require('http');
const https = require('https');

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

let getEncoding = function(headers) {
    let result = 'utf-8'; //default encoding

    Object.keys(headers).forEach(function (key) {
        if (key.toLowerCase() === 'content-type') {
            let split = headers[key].toLowerCase().split('charset=');
            result = split.length === 2 ? split[1] : result;
        }
    });

    return result;
}

let createGrpcResponse = (status, data) => {
    if (data) {
        return {output: data, status: status};
    } else {
        return {status: status};
    }
}

let HttpResponseHandler = grpcCallback => {
    return (res) => {
       const responseEncoding = getEncoding(res.headers);
       res.setEncoding(responseEncoding);
       let chunks = [];
       res.on('data', chunk => {
           chunks.push(Buffer.from(chunk, responseEncoding))
       });
       res.on('close', chunk => {
           if (chunk) {
               chunks.push(Buffer.from(chunk, responseEncoding));
           }
           grpcCallback(null, createGrpcResponse('COMPLETED', Buffer.concat(chunks).toString(responseEncoding)))
       });
       res.on('aborted', _ => grpcCallback(null, createGrpcResponse('FAILED')));
    }
}


function executeHttp(workerHttpRequest, grpcCallback) {
    // prepare request from the data from GRPc call
    const options = JSON.parse(workerHttpRequest.request.requestOptions);
    const req = https.request(options, HttpResponseHandler(grpcCallback));

    req.on('error', (e) => {
        //TODO log
        grpcCallback(null, createGrpcResponse('FAILED'));
    });

    // use its "timeout" event to abort the request
    req.on('timeout', () => {
        //TODO log
        req.abort();
    });

    req.on('abort', () => {
        //TODO log
        grpcCallback(null, createGrpcResponse('FAILED'));
    });

    req.on('response', () => {
        //TODO log
    });

    //write POST or PUT content
    if (workerHttpRequest.request.httpPayload) {
        req.write(workerHttpRequest.request.httpPayload, getEncoding(options.headers));
    }

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
