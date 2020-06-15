const ConductorClient = require('conductor-client').default
const {doHttpRequest} = require('./httpclient2');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.simple(),
    defaultMeta: { service: 'conductor-poller' },
    transports: [
        new winston.transports.Console({ level: 'debug' }),
        new winston.transports.File({ filename: 'conductor_poller_error.log', level: 'error' }),
        new winston.transports.File({ filename: 'conductor_poller.log' }),
    ],
});
const conductorClient = new ConductorClient({
    baseURL: 'http://localhost:8080/api'
})

const httpTaskDef =
    {
        name: 'http_task',
        retryCount: 3,
        timeoutSeconds: 3600,
        inputKeys: ['body', 'uri', 'method', 'timeout', 'verifyCertificate', 'headers', 'basicAuth', 'contentType', 'cookies'],
        outputKeys: ['http_response'],
        timeoutPolicy: 'TIME_OUT_WF',
        retryLogic: 'FIXED',
        retryDelaySeconds: 60,
        responseTimeoutSeconds: 3600
    };


let frinxHttpParamsToHttpParams = (
    uri,
    method,
    body,
    timeout,
    verifyCertificate,
    headers,
    basicAuth,
    contentType,
    cookies ) => {
    let httpOptions = {};
    const parsedUrl = new URL(uri);
    httpOptions['method'] = method;
    httpOptions['protocol'] = parsedUrl.protocol;
    httpOptions['hostname'] = parsedUrl.hostname;

    if (parsedUrl.port) {
        httpOptions['port'] = parsedUrl.port;
    }

    httpOptions['path'] = parsedUrl.pathname + parsedUrl.search;
    httpOptions['insecure'] = !verifyCertificate;

    if (contentType) {
        if (headers) {
            headers = {};
        }
        headers['Content-Type'] = contentType;
    }

    if (headers) {
        httpOptions['headers'] = headers;
    }

    if (timeout) {
        httpOptions['timeout'] = timeout;
    }

    //TODO basic Auth
    //TODO cookies
    return httpOptions;
}

let registerHttpWorker = () => conductorClient.registerWatcher(
    httpTaskDef.name,
    async (data, updater) => {
        try {
            logger.verbose('Received task data type: ', data.taskType, ' data: ', data.inputData)

            const httpOptions = frinxHttpParamsToHttpParams(
                data.inputData.uri,
                data.inputData.method,
                data.inputData.body,
                data.inputData.timeout,
                data.inputData.verifyCertificate,
                data.inputData.headers,
                data.inputData.basicAuth,
                data.inputData.contentType,
                data.inputData.cookies,
            );

            logger.debug('httpOptions', httpOptions);
            doHttpRequest(httpOptions, data.inputData.body, async (err, response) => {
                await conductorClient.updateTask({
                    workflowInstanceId: data.workflowInstanceId,
                    taskId: data.taskId,
                    status: response.status,
                    outputData: {
                        http_response: response.output
                    },
                    logs: ['2233344']
                });
            } )

        } catch (error) {
            logger.error('Unable to do HTTP request ', error);
            //TODO error handling ?
        }
    },
    { pollingIntervals: 1000, autoAck: true, maxRunner: 1 },
    true
);

exports.httpTaskDef = httpTaskDef;
exports.registerHttpWorker = registerHttpWorker;