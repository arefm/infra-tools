// ===== IMPORTS & DEPENDENCIES =====
const docker = require('../services/docker');
const logger = require('../utils/logger');
const { ConfigUtils } = require('../utils/config');
const chalk = require('chalk');

// ===== VARS COMMAND IMPLEMENTATION =====
class VarsCommand {
  static async execute(service, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!service) {
      logger.error('Please specify a service to show environment variables for');
      return;
    }

    // Validate service
    if (!(await docker.validateServices([service]))) {
      return;
    }

    logger.header(`Environment Variables: ${service}`);

    try {
      // Get container name
      const containerName = ConfigUtils.getContainerName(service);
      const possibleNames = [containerName, `${containerName}-1`, `${containerName}_1`];

      let container = null;
      for (const name of possibleNames) {
        try {
          container = docker.docker.getContainer(name);
          await container.inspect(); // Test if container exists
          break;
        } catch (error) {
          container = null;
          continue;
        }
      }

      if (!container) {
        logger.error(`Container not found for service '${service}'`);
        logger.info('Make sure the service is running and try again');
        return;
      }

      // Get container details
      const inspection = await container.inspect();
      const envVars = inspection.Config.Env || [];

      if (envVars.length === 0) {
        logger.info('No environment variables found');
        return;
      }

      console.log();
      logger.info(`Found ${envVars.length} environment variables:`);
      console.log();

      // Sort environment variables for better readability
      const sortedVars = envVars.sort();

      // Display environment variables in a formatted way
      sortedVars.forEach(envVar => {
        const [key, ...valueParts] = envVar.split('=');
        const value = valueParts.join('='); // Handle values that might contain '='

        // Color coding for better readability
        console.log(`${chalk.cyan(key.padEnd(30))} = ${chalk.yellow(value || '')}`);
      });

      console.log();
      logger.success(`Total: ${envVars.length} environment variables`);
    } catch (error) {
      logger.error(`Failed to get environment variables: ${error.message}`);
    }
  }
}

module.exports = VarsCommand;
