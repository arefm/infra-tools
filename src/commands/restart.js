// ===== IMPORTS & DEPENDENCIES =====
const ora = require('ora');
const inquirer = require('inquirer');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const { ConfigUtils } = require('../utils/config');

// ===== RESTART COMMAND IMPLEMENTATION =====
class RestartCommand {
  static async execute(services, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Restarting Services');

    // Determine services to restart
    const servicesToRestart = services.length > 0 ? services : ConfigUtils.getAllServices();

    // Validate services
    if (!(await docker.validateServices(servicesToRestart))) {
      return;
    }

    // Check for port conflicts (only for services not currently running)
    const { conflicts, hasConflicts } = await docker.checkPortConflicts(servicesToRestart);

    if (hasConflicts) {
      logger.error('Port conflicts detected:');
      conflicts.forEach(conflict => {
        logger.plain(
          `  • ${conflict.service} (${conflict.description}): Port ${conflict.port} is busy - used by ${conflict.processInfo}`
        );
      });

      console.log();
      logger.info('Solutions:');
      logger.plain('  1. Stop the conflicting services');
      logger.plain('  2. Use dynamic ports: infra-tools start --dynamic-ports');
      logger.plain('  3. Skip port checking: SKIP_PORT_CHECK=true infra-tools restart');

      const { continueAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Continue anyway?',
          default: false,
        },
      ]);

      if (!continueAnyway) {
        logger.info('Service restart cancelled due to port conflicts.');
        return;
      }

      logger.warning('Proceeding despite port conflicts...');
    }

    const spinner = ora('Restarting services...').start();

    try {
      if (services.length === 0) {
        logger.info('Restarting all services...');
        await docker.executeComposeCommand('restart');
        spinner.succeed('All services restarted successfully!');
      } else {
        logger.info(`Restarting services: ${servicesToRestart.join(', ')}`);
        await docker.executeComposeCommand('restart', servicesToRestart);
        spinner.succeed('Services restarted successfully!');
      }
    } catch (error) {
      spinner.fail(`Failed to restart services: ${error.message}`);
      throw error;
    }
  }
}

module.exports = RestartCommand;
