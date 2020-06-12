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
                    http_options: '${workflow.input.http_options}',
                    http_body_data: '${workflow.input.http_body_data}'
                },
                type: 'SIMPLE',
                startDelay: 0,
                optional: false
            }
        ],
        inputParameters: ['http_options', 'http_body_data'],
        failureWorkflow: 'fail_rollback',
        schemaVersion: 2
    }
]

let options = {
    protocol: 'https:',
    host: 'httpbin.org',
    path: '/post',
    method: 'POST',
    headers: {'Content-Type': 'text/html; charset=UTF8'}
};

conductorClient
    .registerTaskDefs([httpTaskDef])
    .then(() =>
        conductorClient.updateWorkflowDefs(workflowDefs).then(() => {
            conductorClient.startWorkflow('test_workflow', {
                http_options: options, http_body_data: 'some data'
            }).then(xxx => console.log('workflow start:', xxx.data));
        })
    )
    .catch(error => console.dir(error, { depth: 10 }))

registerHttpWorker();