const ConductorClient = require('conductor-client').default
const {sampleWorkflowDef} = require('../shared/defs');
const {config} = require('../shared/utils');
const vault = require('node-vault')(config.vault);

const conductorClient = new ConductorClient({
    baseURL: config.conductor_url
});

const input = {
    http_request: {
        uri: 'https://httpbin.org/post',
        method: 'POST',
        headers: {'Content-Type': 'text/html; charset=UTF8', 'X-Vault-Test':'___SECRET_secret/key1:f1___'},
        body: `[___SECRET_secret/key1:f1___,___SECRET_secret/key2:f2___,___SECRET_secret/key1:f2___]`,
        timeout: 1000
    }
};

function assertEquals(a, b) {
    if (a!=b) {
        throw `Assertion error: ${a} != ${b}`;
    }
}

function checkResult(response) {
    assertEquals(response.headers['X-Vault-Test'], '1');
    const body = response.json;
    const expectedBody = [1, 20, 2];
    assertEquals(JSON.stringify(body), JSON.stringify(expectedBody));
    console.log('All OK');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('Writing sample data to Vault');
    await vault.write('secret/key1', {f1:1, f2:2});
    await vault.write('secret/key2', {f1:10, f2:20});
    await conductorClient.updateWorkflowDefs([sampleWorkflowDef]);
    const workflowId = (await conductorClient.startWorkflow(sampleWorkflowDef.name, input)).data;
    console.log('workflow started, id: ', workflowId);
    for (let iterations = 0; ; iterations++) {
        if (iterations == 100) {
            throw 'Workflow did not complete';
        }
        let polled = await conductorClient.getWorkflow(workflowId);
        if (polled.data.status === 'COMPLETED') {
            console.log('Checking', polled.data.output.body);
            const body = JSON.parse(polled.data.output.body);
            checkResult(body);
            break;
        } else {
            console.log(iterations, polled.data.status);
        }
        await sleep(100);
    }
}

main();
