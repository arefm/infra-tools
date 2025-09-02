// ===== IMPORTS & DEPENDENCIES =====
const ora = require('ora');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const { ConfigUtils } = require('../utils/config');

// ===== STOP COMMAND IMPLEMENTATION =====
class StopCommand {
  static async execute(services, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Stopping Services');

    // Determine services to stop
    const servicesToStop = services.length > 0 ? services : ConfigUtils.getAllServices();

    // Validate services
    if (!(await docker.validateServices(servicesToStop))) {
      return;
    }

    const spinner = ora('Stopping services...').start();

    try {
      if (services.length === 0) {
        // Stop all services - use down command
        logger.info('Stopping all services...');
        await docker.executeComposeCommand('down');
        spinner.succeed('All services stopped successfully!');
      } else {
        // Stop specific services - use stop command
        logger.info(`Stopping services: ${servicesToStop.join(', ')}`);
        await docker.executeComposeCommand('stop', servicesToStop);
        spinner.succeed('Services stopped successfully!');
      }
    } catch (error) {
      spinner.fail(`Failed to stop services: ${error.message}`);
      throw error;
    }
  }
}

module.exports = StopCommand;
