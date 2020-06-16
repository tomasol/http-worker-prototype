const ConductorClient = require('conductor-client').default
const {sendGrpcRequest} = require('./httpworker-grpc-client');
const {conductorHttpParamsToNodejsHttpParams} = require('./utils');
const config = require('./config.json');
const {httpTaskDef} = require('./defs');
const {createLogger} = require('./utils');

const environment = process.env.NODE_ENV || 'development';
const pollerConfig = config[environment];

const logger = createLogger('conductor-poller', pollerConfig.poller_log, 'debug', 'debug');

const conductorClient = new ConductorClient({
    baseURL: pollerConfig.conductor_url
})

async function updateWorkflowState(workflowInstanceId, taskId, grpcResponse) {
    await conductorClient.updateTask({
        workflowInstanceId: workflowInstanceId,
        taskId: taskId,
        status: grpcResponse.status,
        outputData: {
            response: {headers: grpcResponse.headers},
            body: grpcResponse.body,
            statusCode: grpcResponse.statusCode,
            cookies: grpcResponse.cookies
        },
        logs: ['HTTP request finished with status ' + grpcResponse.status]
    });
}

let registerHttpWorker = () => conductorClient.registerWatcher(
    httpTaskDef.name,
    async (data, updater) => {
        try {
            logger.verbose(`Received task data type: ${data.taskType} data: ${data.inputData}`);

            const httpOptions = conductorHttpParamsToNodejsHttpParams(
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

            sendGrpcRequest(httpOptions, data.inputData.body,
                async (err, grpcResponse) => {
                    logger.verbose(`Response from worker was received: ${grpcResponse.cookies}`);
                    await updateWorkflowState(data.workflowInstanceId, data.taskId, grpcResponse);
                });
        } catch (error) {
            logger.error('Unable to do HTTP request ', error);
            //TODO error handling ?
        }
    },
    {pollingIntervals: 1000, autoAck: true, maxRunner: 1},
    true
);

exports.registerHttpWorker = registerHttpWorker;
