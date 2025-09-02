// ===== IMPORTS & DEPENDENCIES =====
const docker = require('../services/docker');
const logger = require('../utils/logger');
const platform = require('../utils/platform');

// ===== EXEC COMMAND IMPLEMENTATION =====
class ExecCommand {
  static async execute(service, command, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!service) {
      logger.error('Please specify a service for exec');
      return;
    }

    // Validate service
    if (!(await docker.validateServices([service]))) {
      return;
    }

    // Check if service is running
    const serviceStatus = await docker.getServiceStatus(service);
    if (serviceStatus.status !== 'running') {
      logger.error(`Service '${service}' is not running (status: ${serviceStatus.status})`);
      logger.info(`Start the service first: infra-tools start ${service}`);
      return;
    }

    // Default command is bash/sh
    const execCommand =
      command.length > 0 ? command.join(' ') : platform.isWindows ? 'cmd' : 'bash';

    logger.info(`Executing '${execCommand}' in ${service}...`);
    console.log();

    try {
      await docker.executeComposeCommand(`exec ${service} ${execCommand}`, [], {
        stdio: 'inherit',
      });
    } catch (error) {
      logger.error(`Failed to execute command: ${error.message}`);
    }
  }
}

module.exports = ExecCommand;
