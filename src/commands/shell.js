// ===== IMPORTS & DEPENDENCIES =====
const docker = require('../services/docker');
const logger = require('../utils/logger');
const platform = require('../utils/platform');
// ConfigUtils import removed - not used

// ===== SHELL COMMAND IMPLEMENTATION =====
class ShellCommand {
  static async execute(service, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!service) {
      logger.error('Please specify a service for shell access');
      return;
    }

    // Validate service
    if (!(await docker.validateServices([service]))) {
      return;
    }

    // Check if service is running
    const serviceStatus = await docker.getServiceStatus(service);
    if (serviceStatus.status !== 'running') {
      logger.error(`Service '${service}' is not running (status: ${serviceStatus.status})`);
      logger.info(`Start the service first: infra-tools start ${service}`);
      return;
    }

    logger.info(`Opening interactive shell in ${service}...`);
    console.log();

    try {
      // Try bash first, fallback to sh, then cmd for Windows containers
      const shells = platform.isWindows ? ['cmd', 'powershell', 'bash', 'sh'] : ['bash', 'sh'];

      let success = false;
      for (const shell of shells) {
        try {
          await docker.executeComposeCommand(`exec ${service} ${shell}`, [], {
            stdio: 'inherit',
          });
          success = true;
          break;
        } catch (error) {
          // Try next shell if this one fails
          if (shell === shells[shells.length - 1]) {
            // Last shell failed, throw error
            throw error;
          }
        }
      }

      if (!success) {
        logger.error('Failed to open shell - no compatible shell found in container');
      }
    } catch (error) {
      logger.error(`Failed to open shell: ${error.message}`);
    }
  }
}

module.exports = ShellCommand;
