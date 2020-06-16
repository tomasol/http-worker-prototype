const PROTO_PATH = __dirname + '/http.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const http = require('http');
const https = require('https');
const winston = require('winston');
const setCookie = require('set-cookie-parser');

const completed = 'COMPLETED';
const failed = 'FAILED';

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    defaultMeta: { service: 'http-worker' },
    transports: [
        new winston.transports.Console({ level: 'debug' }),
        new winston.transports.File({ filename: 'httpworker_error.log', level: 'error' }),
        new winston.transports.File({ filename: 'httpworker.log' }),
    ],
});

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

let createGrpcResponse = (status, statusCode, body, cookies, headers) => {
    if (statusCode) {
        return {status: status, statusCode: statusCode, body: body, cookies: JSON.stringify(cookies), headers: headers};
    } else {
        return {status: status};
    }
}

let supportedEncodings = ["ascii", "utf8", "utf-8", "utf16le", "ucs2", "ucs-2", "base64", "latin1", "binary", "hex"];

let HttpResponseHandler = grpcCallback => {
    return (res) => {
       let responseEncoding = getEncoding(res.headers);

       //TODO can it be better
       if(!supportedEncodings.includes(responseEncoding)) {
           const defaultEncoding = getEncoding({});
           logger.warn(`The response encoding is ${responseEncoding} but it is not supported, defaulting to ${defaultEncoding}`);
           responseEncoding = defaultEncoding;
       }

       res.setEncoding(responseEncoding);
       let chunks = [];
       res.on('data', chunk => {
           chunks.push(Buffer.from(chunk, responseEncoding));
       });
       res.on('close', chunk => {
           if (chunk) {
               chunks.push(Buffer.from(chunk, responseEncoding));
           }
           grpcCallback(null, createGrpcResponse(
               completed,res.statusCode,
              Buffer.concat(chunks).toString(responseEncoding),
               setCookie.parse(res),
               JSON.stringify(res.headers)))
       });
        res.on('aborted', _ => grpcCallback(null, createGrpcResponse(failed)));
    }
}

let pickLibrary = protocol => 'https:' === protocol ? https : http;

function executeHttp(workerHttpRequest, grpcCallback) {
    // prepare request from the data from GRPc call
    const options = JSON.parse(workerHttpRequest.request.requestOptions);

    let req;
    try{
        req = pickLibrary(options.protocol).request(options, HttpResponseHandler(grpcCallback));
    } catch (e) {
        logger.error(`Unable to complete the HTTP request for ${options.uri}, finished with error ${e}`);
        grpcCallback(null, createGrpcResponse(failed));
        return;
    }

    req.on('error', (e) => {
        logger.error(`Error occured while doing a HTTP request: ${e}`);
        grpcCallback(null, createGrpcResponse(failed));
    });

    // when socket times out we need to abort manually ..
    req.on('timeout', () => {
        logger.error('Timeout occurred while doing a HTTP request, aborting request');
        req.abort();
    });

    req.on('abort', () => {
        logger.error('The request was aborted');
        grpcCallback(null, createGrpcResponse(failed));
    });

    req.on('response', () => {
        logger.verbose('The HTTP response was received');
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
