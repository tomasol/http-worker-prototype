const ConductorClient = require('conductor-client').default
const {sendGrpcRequest} = require('./grpc-client');
const {conductorHttpParamsToNodejsHttpParams} = require('../shared/utils');
const {httpTaskDef} = require('../shared/defs');
const {createLogger, config} = require('../shared/utils');
const vault = require('node-vault')(config.vault);

const logger = createLogger('conductor-poller', config.poller_log, config.console_log_level, config.overall_log_level);

const conductorClient = new ConductorClient({
    baseURL: config.conductor_url
});

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

async function markWorkflowFailed(workflowInstanceId, taskId) {
    await conductorClient.updateTask({
        workflowInstanceId: workflowInstanceId,
        taskId: taskId,
        status: 'FAILED',
    });
}

// Vault itself does not impose those rules on paths and fields.
// UI should follow those rules in order to make parsing easy.
const SECRET_PREFIX = '___SECRET_';
const SECRET_PATH_REGEX = '([a-zA-Z0-9/]+)';
const SECRET_VAR_FIELD_SEPARATOR = ':';
const SECRET_FIELD_REGEX = '([a-zA-Z0-9]+)';
const SECRET_SUFFIX = '___';
const SECRET_REGEX = new RegExp(SECRET_PREFIX + SECRET_PATH_REGEX + SECRET_VAR_FIELD_SEPARATOR + SECRET_FIELD_REGEX + SECRET_SUFFIX);

async function obtainSecretFromVault(path, field) {
    try {
        const response = await vault.read(config.vault.pathPrefix + path);
        return response.data[field];
    } catch (error) {
        logger.warn(`Cannot obtain secret: ${error}, path '${path}' field '${field}'`);
        throw new Error('Cannot obtain secret');
    }
}

function replaceAll(str, toBeReplaced, newSubstr) {
    let newStr = str;
    do {
        str = newStr;
        newStr = str.replace(toBeReplaced, newSubstr);
    } while (str != newStr);
    return str;
}

async function replaceSecretsInString(str) {
    let r;
    while(r = SECRET_REGEX.exec(str)) {
        const toBeReplaced = r[0];
        const path = r[1];
        const field = r[2];
        const payload = await obtainSecretFromVault(path, field);
        str = replaceAll(str, toBeReplaced, payload);
    }
    return str;
}

async function replaceSecrets(input) {
    for (const key in input) {
        const val = input[key];
        if (typeof val === 'object') {
            input[key] = await replaceSecrets(val);
        } else if (typeof val === 'string') {
            input[key] = await replaceSecretsInString(val);
        }
    }
    return input;
}

/**
 * registers polling for the http worker task
 */
let registerHttpWorker = async () => conductorClient.registerWatcher(
    httpTaskDef.name,
    async (data, updater) => {
        const rawInput = data.inputData.http_request;
        try {
            logger.verbose(`Received task data type: ${data.taskType} data: ${JSON.stringify(rawInput)}`);
            const input = await replaceSecrets(rawInput);
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
                        await markWorkflowFailed(data.workflowInstanceId, data.taskId);
                    } else {
                        logger.info(`Response from HTTP worker was received with status code: ${grpcResponse.statusCode}`);
                        logger.debug('Response from HTTP worker was received', grpcResponse);
                        await updateWorkflowState(data.workflowInstanceId, data.taskId, grpcResponse);
                    }
                });
        } catch (error) {
            logger.error(`Unable to do HTTP request because: ${error}. I am failing the task with ID: ${data.taskId} in workflow with ID: ${data.workflowInstanceId}`);
            await markWorkflowFailed(data.workflowInstanceId, data.taskId);
        }
    },
    {pollingIntervals: 1000, autoAck: true, maxRunner: 1},
    true
);

const registerTaskDef = async() => await conductorClient.registerTaskDefs([httpTaskDef]);

exports.registerHttpWorker = registerHttpWorker;
exports.registerTaskDef = registerTaskDef;
