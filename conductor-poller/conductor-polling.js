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
            logger.verbose(`Received task data type: ${data.taskType} data: ${JSON.stringify(data.inputData.http_request)}`);

            const httpOptions = conductorHttpParamsToNodejsHttpParams(
                data.inputData.http_request.uri,
                data.inputData.http_request.method,
                data.inputData.http_request.body,
                data.inputData.http_request.timeout,
                data.inputData.http_request.verifyCertificate,
                data.inputData.http_request.headers,
                data.inputData.http_request.basicAuth,
                data.inputData.http_request.contentType,
                data.inputData.http_request.cookies,
            );

            sendGrpcRequest(httpOptions, data.inputData.http_request.body,
                async (err, grpcResponse) => {
                    logger.verbose(`Response from HTTP worker was received with status code: ${grpcResponse.statusCode}`);
                    await updateWorkflowState(data.workflowInstanceId, data.taskId, grpcResponse);
                });
        } catch (error) {
            logger.error(`Unable to do HTTP request because: ${error}. I am failing the task with ID: ${data.taskId} in workflow with ID: ${data.workflowInstanceId}`);
            updateWorkflowState(data.workflowInstanceId, data.taskId, {status: 'FAILED'});
        }
    },
    {pollingIntervals: 1000, autoAck: true, maxRunner: 1},
    true
);

exports.registerHttpWorker = registerHttpWorker;
