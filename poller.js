const ConductorClient = require('conductor-client').default

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
                name: 'print_money',
                taskReferenceName: 'print_money',
                inputParameters: {
                    money: '${workflow.input.money}'
                },
                type: 'SIMPLE',
                startDelay: 0,
                optional: false
            }
        ],
        inputParameters: ['money'],
        failureWorkflow: 'fail_rollback',
        schemaVersion: 2
    }
]

const taskDefs = [
    {
        name: 'print_money',
        retryCount: 3,
        timeoutSeconds: 3600,
        inputKeys: ['money'],
        outputKeys: ['printed_money'],
        timeoutPolicy: 'TIME_OUT_WF',
        retryLogic: 'FIXED',
        retryDelaySeconds: 60,
        responseTimeoutSeconds: 3600
    }
]

conductorClient
    .registerTaskDefs(taskDefs)
    .then(() =>
        conductorClient.updateWorkflowDefs(workflowDefs).then(() => {
            conductorClient.registerWatcher(
                'print_money',
                async (data, updater) => {
                    try {
                        console.log(data.taskType, data.inputData)
                        // await updater.inprogress({
                        //     outputData: { printed_money: 'I am printing money!' },
                        //     callbackAfterSeconds: 123,
                        //     logs: ['ello', 'eieiei', 'huhu', JSON.stringify({ hello: 'test' })]
                        // })
                       
                        setTimeout(() => {
                            //console.log('setmTimout started ', data)
                            conductorClient.updateTask({
                                workflowInstanceId: data.workflowInstanceId,
                                taskId: data.taskId,
                                status: 'COMPLETED',
                                outputData: {
                                    printed_money: 'Final value'
                                },
                                logs: ['2233344']
                            })
                        }, 20000)
                    } catch (error) {
                        console.log(error)
                    }
                },
                { pollingIntervals: 1000, autoAck: true, maxRunner: 1 },
                true
            )


            conductorClient.startWorkflow('test_workflow', {
                money: 200
            }).then(xxx => console.log('workflow start:', xxx.data));
        })
    )
    .catch(error => console.dir(error, { depth: 10 }))
