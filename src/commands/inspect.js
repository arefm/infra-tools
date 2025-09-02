// ===== IMPORTS & DEPENDENCIES =====
const docker = require('../services/docker');
const logger = require('../utils/logger');
const { ConfigUtils } = require('../utils/config');

// ===== INSPECT COMMAND IMPLEMENTATION =====
class InspectCommand {
  static async execute(service, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!service) {
      logger.error('Please specify a service to inspect');
      return;
    }

    // Validate service
    if (!(await docker.validateServices([service]))) {
      return;
    }

    logger.header(`Inspecting Container: ${service}`);

    try {
      // First show compose ps information
      logger.info(`Container status for ${service}:`);
      await docker.executeComposeCommand(`ps ${service}`, [], {
        stdio: 'inherit',
      });

      console.log();

      // Then show detailed container inspection
      logger.info('Detailed container information:');
      console.log();

      const containerName = ConfigUtils.getContainerName(service);

      // Try different container name formats
      const possibleNames = [containerName, `${containerName}-1`, `${containerName}_1`];

      let inspectionSuccess = false;
      for (const name of possibleNames) {
        try {
          const container = docker.docker.getContainer(name);
          const inspection = await container.inspect();
          console.log(JSON.stringify(inspection, null, 2));
          inspectionSuccess = true;
          break;
        } catch (error) {
          // Try next name format
          continue;
        }
      }

      if (!inspectionSuccess) {
        logger.error(`Container not found for service '${service}'`);
        logger.info('Make sure the service is running and try again');
      }
    } catch (error) {
      logger.error(`Failed to inspect container: ${error.message}`);
    }
  }
}

module.exports = InspectCommand;
