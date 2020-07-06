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

const SECRET_PREFIX = '___SECRET_';
const SECRET_SUFFIX = '___';
const SECRET_REGEX = new RegExp(SECRET_PREFIX + '([a-zA-Z0-9]+)' + SECRET_SUFFIX);

function obtainSecret(key) {
    logger.debug(`obtainSecret ${key}`);
    return 'val(' + key + ')';
}

function replaceAll(str, toBeReplaced, newSubstr) {
    let newStr = str;
    do {
        str = newStr;
        newStr = str.replace(toBeReplaced, newSubstr);
    } while (str != newStr);
    return str;
}

function replaceSecretsInString(str) {
    let r;
    while(r = SECRET_REGEX.exec(str)) {
        const toBeReplaced = r[0];
        const key = r[1];
        str = replaceAll(str, toBeReplaced, obtainSecret(key));
    }
    return str;
}

function replaceSecrets(input) {
    for (const key in input) {
        const val = input[key];
        if (typeof val === 'object') {
            input[key] = replaceSecrets(val);
        } else if (typeof val === 'string') {
            input[key] = replaceSecretsInString(val);
        }
    }
    return input;
}

/**
 * registers polling for the http worker task
 */
let registerHttpWorker = () => conductorClient.registerWatcher(
    httpTaskDef.name,
    async (data, updater) => {
        const rawInput = data.inputData.http_request;
        const input = replaceSecrets(rawInput);
        try {
            logger.verbose(`Received task data type: ${data.taskType} data: ${JSON.stringify(input)}`);

            const httpOptions = conductorHttpParamsToNodejsHttpParams(
                input.uri,
                input.method,
                input.body,
                input.timeout,
                input.verifyCertificate,
                input.headers,
                input.basicAuth,
                input.contentType,
                input.cookies,
            );

            sendGrpcRequest(httpOptions, input.body,
                async (err, grpcResponse) => {
                    if (err != null) {
                        logger.warn('Error while sending grpc request', err);
                    }
                    // TODO handle err
                    logger.info(`Response from HTTP worker was received with status code: ${grpcResponse.statusCode}`);
                    logger.debug('Response from HTTP worker was received', grpcResponse);
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
