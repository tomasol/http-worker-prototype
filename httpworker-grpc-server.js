const PROTO_PATH = __dirname + '/http.proto';
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const http = require('http');
const https = require('https');
const config = require('./config.json');
const setCookie = require('set-cookie-parser');
const {createLogger, supportedEncodings, createGrpcResponse} = require('./utils');

const environment = process.env.NODE_ENV || 'development';
const workerConfig = config[environment];

const completed = 'COMPLETED';
const failed = 'FAILED';

const logger = createLogger('http-worker', workerConfig.httpworker_log, 'debug', 'debug');

const packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
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

let HttpResponseHandler = grpcCallback => {
    return (res) => {
       let responseEncoding = getEncoding(res.headers);

       //TODO handle encoding mismatch?
       if (!supportedEncodings.includes(responseEncoding)) {
           const defaultEncoding = getEncoding({});
           logger.warn(`The response encoding is ${responseEncoding} but it is not supported, defaulting to ${defaultEncoding}`);
           responseEncoding = defaultEncoding;
       }

       res.setEncoding(responseEncoding);
       let chunks = []; // for storing response 'chunks' as they arrive one by one
       res.on('data', chunk => {
           chunks.push(Buffer.from(chunk, responseEncoding)); //store incoming data
       });
       res.on('close', chunk => { // we are done, http is closed
           if (chunk) {
               chunks.push(Buffer.from(chunk, responseEncoding));
           }
           grpcCallback(null, createGrpcResponse(
               completed,
               res.statusCode,
               Buffer.concat(chunks).toString(responseEncoding),
               setCookie.parse(res),
               JSON.stringify(res.headers)))
       });
        res.on('aborted', _ => grpcCallback(null, createGrpcResponse(failed)));
    }
}

let pickLibrary = protocol => 'https:' === protocol ? https : http;

function executeHttp(workerHttpRequest, grpcCallback) {
    // prepare HTTP request parameters from the data received via the gRPC call
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
routeServer.bind(workerConfig.httpworker_bind_address, grpc.ServerCredentials.createInsecure());
routeServer.start();
