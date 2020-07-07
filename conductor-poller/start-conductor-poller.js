const {registerTaskDef, registerHttpWorker} = require('./conductor-polling');
const {createLogger, config} = require('../shared/utils');
const {httpTaskDef} = require('../shared/defs');

const logger = createLogger('conductor-starter', config.poller_log, config.console_log_level, config.overall_log_level);

async function main() {
    logger.info(`Registering http taskdef URL ${config.conductor_url}`)
    await registerTaskDef();
    logger.info('Starting polling')
    await registerHttpWorker();
}

main();
