const ConductorClient = require('conductor-client').default
const {registerHttpWorker} = require('./conductor-polling');
const {httpTaskDef, sampleWorkflowDef} = require('../shared/defs');

const conductorClient = new ConductorClient({
    baseURL: 'http://localhost:8080/api'
})

const input = {
    http_request: {
        uri: 'https://httpbin.org/post',
        method: 'POST',
        headers: {'Content-Type': 'text/html; charset=UTF8'},
        body: 'some data',
        timeout: 1000
    }
};

const input2 = {
    http_request: {
        uri: 'https://postman-echo.com/cookies/set?foo1=bar1&foo2=bar2',
        method: 'GET',
        timeout: 1000
    }
};

// update definitions in conductor and start workflow
conductorClient
    .registerTaskDefs([httpTaskDef])
    .then(() =>
        conductorClient.updateWorkflowDefs([sampleWorkflowDef]).then(() => {
            conductorClient.startWorkflow(sampleWorkflowDef.name, input2).then(workflow => console.log('workflow started, id: ', workflow.data));
        })
    )
    .catch(error => console.dir(error, {depth: 10}))

// start worker
registerHttpWorker();
