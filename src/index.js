// ===== IMPORTS & DEPENDENCIES =====
const { CONFIG, ConfigUtils } = require('./utils/config');
const docker = require('./services/docker');
const platform = require('./utils/platform');
const logger = require('./utils/logger');
const WindowsUtils = require('./platform/windows');

// ===== MAIN CLI MODULE =====
class DevToolsCLI {
  constructor() {
    this.docker = docker;
    this.platform = platform;
    this.config = CONFIG;
    this.utils = ConfigUtils;
  }

  // ===== INITIALIZATION =====
  async initialize() {
    // Platform-specific initialization
    if (platform.isWindows) {
      const setupSuccess = await WindowsUtils.setupWindowsEnvironment();
      if (!setupSuccess) {
        process.exit(1);
      }
    }

    // Check Docker connection
    const dockerAvailable = await docker.checkDockerConnection();
    if (!dockerAvailable) {
      process.exit(1);
    }

    return true;
  }

  // ===== SERVICE HELPERS =====
  getAllServices() {
    return ConfigUtils.getAllServices();
  }

  getServiceGroups() {
    return CONFIG.SERVICE_GROUPS;
  }

  validateService(serviceName) {
    return ConfigUtils.isValidService(serviceName);
  }

  // ===== UTILITY METHODS =====
  async getSystemInfo() {
    return {
      platform: platform.getSystemInfo(),
      docker: await this.checkDockerStatus(),
      services: await this.getServicesOverview(),
    };
  }

  async checkDockerStatus() {
    try {
      const dockerInfo = await docker.docker.info();
      return {
        available: true,
        version: dockerInfo.ServerVersion,
        containers: dockerInfo.Containers,
        images: dockerInfo.Images,
        volumes: dockerInfo.Volumes,
      };
    } catch (error) {
      return {
        available: false,
        error: error.message,
      };
    }
  }

  async getServicesOverview() {
    const allServices = ConfigUtils.getAllServices();
    const overview = {
      total: allServices.length,
      running: 0,
      stopped: 0,
      groups: CONFIG.SERVICE_GROUPS,
    };

    for (const service of allServices) {
      const status = await docker.getServiceStatus(service);
      if (status.status === 'running') {
        overview.running++;
      } else {
        overview.stopped++;
      }
    }

    return overview;
  }
}

// ===== EXPORTS =====
module.exports = {
  DevToolsCLI,
  CONFIG,
  ConfigUtils,
  docker,
  platform,
  logger,
};
