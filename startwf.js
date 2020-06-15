const ConductorClient = require('conductor-client').default
const {httpTaskDef, registerHttpWorker} = require('./poller2');

const conductorClient = new ConductorClient({
    baseURL: 'http://localhost:8080/api'
})

const workflowDefs = [
    {
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
]

const input = {
    uri: 'https://httpbin.org/post',
    method: 'POST',
    headers: {'Content-Type': 'text/html; charset=UTF8'},
    body: 'some data',
    timeout: 1000
};

const input2 = {
    uri: 'https://postman-echo.com/cookies/set?foo1=bar1&foo2=bar2',
    method: 'GET',
    timeout: 1000
};


conductorClient
    .registerTaskDefs([httpTaskDef])
    .then(() =>
        conductorClient.updateWorkflowDefs(workflowDefs).then(() => {
            conductorClient.startWorkflow('test_workflow', input2).then(xxx => console.log('workflow start:', xxx.data));
        })
    )
    .catch(error => console.dir(error, { depth: 10 }))

registerHttpWorker();