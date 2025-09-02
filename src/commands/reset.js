// ===== IMPORTS & DEPENDENCIES =====
const inquirer = require('inquirer');
const ora = require('ora');
const docker = require('../services/docker');
const logger = require('../utils/logger');
// platform and CONFIG imports removed - not used

// ===== RESET COMMAND IMPLEMENTATION =====
class ResetCommand {
  static async execute(_options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Resetting Environment');
    logger.warning('This will remove ALL containers and volumes!');

    const { confirmReset } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmReset',
        message: 'Are you sure?',
        default: false,
      },
    ]);

    if (!confirmReset) {
      logger.info('Reset cancelled.');
      return;
    }

    const spinner = ora('Stopping all services...').start();

    try {
      // Stop all services and remove volumes
      spinner.text = 'Stopping services and removing containers...';
      await docker.executeComposeCommand('down -v --remove-orphans');

      spinner.text = 'Removing project volumes...';

      // Get all project volumes and remove them
      const volumes = await docker.getVolumes();
      if (volumes.length > 0) {
        const volumeNames = volumes.map(v => v.name);

        for (const volumeName of volumeNames) {
          try {
            await docker.removeVolume(volumeName);
            logger.info(`Removed volume: ${volumeName}`);
          } catch (error) {
            logger.warning(`Could not remove volume ${volumeName}: ${error.message}`);
          }
        }
      }

      spinner.succeed('Environment reset complete!');

      console.log();
      logger.info('All services and data have been removed.');
      logger.info("Run 'infra-tools start' to recreate the environment.");
    } catch (error) {
      spinner.fail(`Reset failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ResetCommand;
