const httpTaskDef = {
    name: 'http_task',
    retryCount: 3,
    timeoutSeconds: 3600,
    inputKeys: ['body', 'uri', 'method', 'timeout', 'verifyCertificate', 'headers', 'basicAuth', 'contentType', 'cookies'],
    outputKeys: ['statusCode', 'response', 'body', 'cookies'],
    timeoutPolicy: 'TIME_OUT_WF',
    retryLogic: 'FIXED',
    retryDelaySeconds: 60,
    responseTimeoutSeconds: 3600
};

const sampleWorkflowDef = {
    name: 'test_workflow',
    description: 'test workflow',
    version: 1,
    tasks: [
        {
            name: httpTaskDef.name,
            taskReferenceName: httpTaskDef.name,
            inputParameters: {
                body: '${workflow.input.body}',
                uri: '${workflow.input.uri}',
                method: '${workflow.input.method}',
                timeout: '${workflow.input.timeout}',
                verifyCertificate: '${workflow.input.verifyCertificate}',
                headers: '${workflow.input.headers}',
                basicAuth: '${workflow.input.basicAuth}',
                contentType: '${workflow.input.contentType}',
                cookies: '${workflow.input.cookies}'
            },
            type: 'SIMPLE',
            startDelay: 0,
            optional: false
        }
    ],
    inputParameters: ['body', 'uri', 'method', 'timeout', 'verifyCertificate', 'headers', 'basicAuth', 'contentType', 'cookies'],
    failureWorkflow: 'fail_rollback',
    schemaVersion: 2
}

exports.httpTaskDef = httpTaskDef;
exports.sampleWorkflowDef = sampleWorkflowDef;
