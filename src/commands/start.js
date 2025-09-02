// ===== IMPORTS & DEPENDENCIES =====
const ora = require('ora');
const inquirer = require('inquirer');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const platform = require('../utils/platform');
const { ConfigUtils } = require('../utils/config');

// ===== START COMMAND IMPLEMENTATION =====
class StartCommand {
  static async execute(services, options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Starting Services');

    // Determine services to start
    const servicesToStart = services.length > 0 ? services : ConfigUtils.getAllServices();

    // Validate services
    if (!(await docker.validateServices(servicesToStart))) {
      return;
    }

    // Validate compose files
    if (!(await docker.validateComposeFiles())) {
      return;
    }

    // Handle dynamic ports
    if (options.dynamicPorts) {
      await this.startWithDynamicPorts(servicesToStart, options);
    } else {
      await this.startWithStaticPorts(servicesToStart, options);
    }
  }

  static async startWithDynamicPorts(services, _options) {
    logger.info('Dynamic port assignment enabled');

    // Show port assignments
    await this.showDynamicPortAssignments(services);

    const spinner = ora('Starting services with dynamic ports...').start();

    try {
      await docker.executeComposeCommand('up -d', services, {
        stdio: 'pipe',
        composeFile: await docker.generateDynamicPortComposeFile(services),
      });

      spinner.succeed('Services started successfully with dynamic ports!');

      // Show final port assignments
      console.log();
      await this.showRunningServicePorts(services);
    } catch (error) {
      spinner.fail(`Failed to start services: ${error.message}`);
      throw error;
    }
  }

  static async startWithStaticPorts(services, _options) {
    // Check for port conflicts
    const { conflicts, hasConflicts } = await docker.checkPortConflicts(services);

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
      logger.plain('  3. Skip port checking: SKIP_PORT_CHECK=true infra-tools start');

      const { continueAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAnyway',
          message: 'Continue anyway?',
          default: false,
        },
      ]);

      if (!continueAnyway) {
        logger.info('Service start cancelled due to port conflicts.');
        return;
      }

      logger.warning('Proceeding despite port conflicts...');
    } else {
      logger.success('No port conflicts detected.');
    }

    // Show service information
    console.log();
    this.showServiceInfo(services);
    console.log();

    const spinner = ora('Starting services...').start();

    try {
      await docker.executeComposeCommand('up -d', services);
      spinner.succeed('Services started successfully!');
    } catch (error) {
      spinner.fail(`Failed to start services: ${error.message}`);
      throw error;
    }
  }

  static async showDynamicPortAssignments(services) {
    logger.info('Generating dynamic port assignments...');

    for (const service of services) {
      const defaultPorts = ConfigUtils.getServicePorts(service) || [];
      const descriptions = ConfigUtils.getServiceDescriptions(service) || [];

      if (defaultPorts && defaultPorts.length > 0) {
        for (let i = 0; i < defaultPorts.length; i++) {
          const basePort = parseInt(defaultPorts[i]);
          const desc = descriptions[i] || 'Unknown';
          const freePort = await platform.findFreePort(basePort);

          if (freePort !== basePort) {
            logger.info(`  • ${service}: Port ${basePort} busy, using ${freePort} (${desc})`);
          } else {
            logger.info(`  • ${service}: Using default port ${basePort} (${desc})`);
          }
        }
      }
    }
  }

  static showServiceInfo(services) {
    logger.info('Services will be available on the following ports:');

    services.forEach(service => {
      const ports = ConfigUtils.getServicePorts(service) || [];
      const descriptions = ConfigUtils.getServiceDescriptions(service) || [];

      if (ports && ports.length > 0) {
        const portInfo = ports
          .map((port, index) => {
            const desc = descriptions[index] || '';
            return `${port} (${desc})`;
          })
          .join(', ');

        logger.plain(`  • ${service}: localhost:${portInfo}`);
      }
    });
  }

  static async showRunningServicePorts(services) {
    logger.info('Current port assignments for running services:');

    for (const service of services) {
      const serviceStatus = await docker.getServiceStatus(service);

      if (serviceStatus.status === 'running' && serviceStatus.ports.length > 0) {
        const portInfo = serviceStatus.ports
          .map(port => `${port.publicPort} (${port.type})`)
          .join(', ');
        logger.plain(`  • ${service}: localhost:${portInfo}`);
      }
    }
  }
}

module.exports = StartCommand;
