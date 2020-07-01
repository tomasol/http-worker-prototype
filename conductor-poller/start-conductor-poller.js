const {registerHttpWorker} = require('./conductor-polling');
const {createLogger, config} = require('../shared/utils');

const logger = createLogger('conductor-starter', config.poller_log, config.console_log_level, config.overall_log_level);

logger.info(`Starting polling of Conductor with URL ${config.conductor_url}`)

registerHttpWorker();
