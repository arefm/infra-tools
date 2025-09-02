// ===== IMPORTS & DEPENDENCIES =====
const ora = require('ora');
const docker = require('../services/docker');
const logger = require('../utils/logger');

// ===== BUILD COMMAND IMPLEMENTATION =====
class BuildCommand {
  static async execute(options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Building Images');

    const spinner = ora('Building images...').start();

    try {
      if (options.noCache) {
        logger.info('Building images without cache...');
        await docker.executeComposeCommand('build --no-cache');
        spinner.succeed('Images built successfully without cache!');
      } else {
        logger.info('Building images...');
        await docker.executeComposeCommand('build');
        spinner.succeed('Images built successfully!');
      }
    } catch (error) {
      spinner.fail(`Failed to build images: ${error.message}`);
      throw error;
    }
  }
}

module.exports = BuildCommand;
