// ===== IMPORTS & DEPENDENCIES =====
const docker = require('../services/docker');
const logger = require('../utils/logger');
// ConfigUtils not used - removed to fix ESLint

// ===== LOGS COMMAND IMPLEMENTATION =====
class LogsCommand {
  static async execute(service, options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!service) {
      logger.error('Please specify a service for logs');
      return;
    }

    // Validate service
    if (!(await docker.validateServices([service]))) {
      return;
    }

    // Check if service is running
    const serviceStatus = await docker.getServiceStatus(service);
    if (serviceStatus.status !== 'running') {
      logger.warning(`Service '${service}' is not running (status: ${serviceStatus.status})`);
      logger.info('Starting service to show logs...');

      try {
        await docker.executeComposeCommand('up -d', [service]);
        logger.success(`Service '${service}' started`);
      } catch (error) {
        logger.error(`Failed to start service: ${error.message}`);
        return;
      }
    }

    if (options.follow) {
      logger.info(`Following logs for ${service} (Ctrl+C to exit)...`);
      console.log();

      try {
        await docker.executeComposeCommand(`logs -f --tail=${options.tail}`, [service], {
          stdio: 'inherit',
        });
      } catch (error) {
        // Ignore interruption errors (Ctrl+C)
        if (!error.message.includes('SIGINT')) {
          logger.error(`Failed to follow logs: ${error.message}`);
        }
      }
    } else {
      logger.info(`Showing recent logs for ${service}...`);
      console.log();

      try {
        await docker.executeComposeCommand(`logs --tail=${options.tail}`, [service], {
          stdio: 'inherit',
        });
      } catch (error) {
        logger.error(`Failed to show logs: ${error.message}`);
      }
    }
  }
}

module.exports = LogsCommand;
