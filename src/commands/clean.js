// ===== IMPORTS & DEPENDENCIES =====
const ora = require('ora');
const docker = require('../services/docker');
const logger = require('../utils/logger');

// ===== CLEAN COMMAND IMPLEMENTATION =====
class CleanCommand {
  static async execute(_options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Cleaning Stopped Containers');

    const spinner = ora('Removing stopped containers...').start();

    try {
      await docker.executeComposeCommand('rm -f');
      spinner.succeed('Stopped containers removed!');
    } catch (error) {
      spinner.fail(`Failed to clean containers: ${error.message}`);
      throw error;
    }
  }
}

module.exports = CleanCommand;
