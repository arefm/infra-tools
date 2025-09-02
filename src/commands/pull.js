// ===== IMPORTS & DEPENDENCIES =====
const ora = require('ora');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const { ConfigUtils } = require('../utils/config');

// ===== PULL COMMAND IMPLEMENTATION =====
class PullCommand {
  static async execute(services, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Pulling Images');

    // Determine services to pull
    const servicesToPull = services.length > 0 ? services : ConfigUtils.getAllServices();

    // Validate services
    if (!(await docker.validateServices(servicesToPull))) {
      return;
    }

    const spinner = ora('Pulling images...').start();

    try {
      if (services.length === 0) {
        logger.info('Pulling all images...');
        await docker.executeComposeCommand('pull');
        spinner.succeed('All images pulled successfully!');
      } else {
        logger.info(`Pulling images for: ${servicesToPull.join(', ')}`);
        await docker.executeComposeCommand('pull', servicesToPull);
        spinner.succeed('Images pulled successfully!');
      }
    } catch (error) {
      spinner.fail(`Failed to pull images: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PullCommand;
