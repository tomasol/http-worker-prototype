const ConductorClient = require('conductor-client').default
const {sendGrpcRequest} = require('./grpc-client');
const {conductorHttpParamsToNodejsHttpParams} = require('../shared/utils');
const {httpTaskDef} = require('../shared/defs');
const {createLogger, config} = require('../shared/utils');

const logger = createLogger('conductor-poller', config.poller_log, config.console_log_level, config.overall_log_level);

const conductorClient = new ConductorClient({
    baseURL: config.conductor_url
})

/**
 * Updates the conductor with results
 * @param workflowInstanceId worfkflow to be updated
 * @param taskId task which does the update
 * @param grpcResponse data received from the HTTP worker
 */
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

/**
 * registers polling for the http worker task
 */
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
                    logger.verbose(`Response from HTTP worker was received with status code: ${grpcResponse.statusCode}`);
                    await updateWorkflowState(data.workflowInstanceId, data.taskId, grpcResponse);
                });
        } catch (error) {
            logger.error(`Unable to do HTTP request ${error}`);
            //TODO error handling ?
        }
    },
    {pollingIntervals: 1000, autoAck: true, maxRunner: 1},
    true
);

exports.registerHttpWorker = registerHttpWorker;
