// ===== IMPORTS & DEPENDENCIES =====
const Docker = require('dockerode');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const { CONFIG, ConfigUtils } = require('../utils/config');
const platform = require('../utils/platform');
const logger = require('../utils/logger');

// ===== DOCKER SERVICE MANAGEMENT =====
class DockerService {
  constructor() {
    this.docker = new Docker();
    this.projectName = CONFIG.PROJECT_NAME;
  }

  // ===== CONTAINER OPERATIONS =====
  async getContainers(serviceFilter = null) {
    try {
      const containers = await this.docker.listContainers({ all: true });

      return containers
        .filter(container => {
          const name = container.Names[0].replace('/', '');
          const isProjectContainer = name.startsWith(`${this.projectName}_`);

          if (!isProjectContainer) {
            return false;
          }

          if (serviceFilter) {
            const serviceName = name.replace(`${this.projectName}_`, '').replace(/-\d+$/, '');
            return serviceName === serviceFilter;
          }

          return true;
        })
        .map(container => ({
          id: container.Id,
          name: container.Names[0].replace('/', ''),
          serviceName: container.Names[0]
            .replace('/', '')
            .replace(`${this.projectName}_`, '')
            .replace(/-\d+$/, ''),
          image: container.Image,
          status: container.Status,
          state: container.State,
          ports: container.Ports,
          created: container.Created,
          labels: container.Labels,
        }));
    } catch (error) {
      logger.error(`Failed to get containers: ${error.message}`);
      return [];
    }
  }

  async getContainerInfo(serviceName) {
    const containers = await this.getContainers(serviceName);
    return containers.length > 0 ? containers[0] : null;
  }

  async getServiceStatus(serviceName) {
    const container = await this.getContainerInfo(serviceName);

    if (!container) {
      return {
        service: serviceName,
        status: 'stopped',
        health: 'unknown',
        ports: [],
        uptime: null,
        image: ConfigUtils.getServiceImage(serviceName),
        networkIp: null,
        volumes: [],
      };
    }

    // Parse container status
    let health = 'unknown';
    let uptime = null;

    if (container.state === 'running') {
      if (container.status.includes('healthy')) {
        health = 'healthy';
      } else if (container.status.includes('unhealthy')) {
        health = 'unhealthy';
      } else {
        health = 'running';
      }

      // Extract uptime from status (e.g., "Up 4 minutes (healthy)")
      const uptimeMatch = container.status.match(/Up (.+?)(?:\s*\(|$)/);
      if (uptimeMatch) {
        uptime = uptimeMatch[1].trim().replace(/About /, '~');
      }
    }

    // Get network IP
    let networkIp = null;
    try {
      const containerDetails = await this.docker.getContainer(container.id).inspect();
      const networks = containerDetails.NetworkSettings.Networks;
      const infraNetwork =
        networks[`${this.projectName}_dev-tools-network`] || networks['dev-tools-network'];
      if (infraNetwork) {
        networkIp = infraNetwork.IPAddress;
      }
    } catch (error) {
      // Ignore network IP errors
    }

    // Parse ports and remove duplicates
    const portsMap = new Map();
    container.ports
      .filter(port => port.PublicPort) // Only show mapped ports
      .forEach(port => {
        const key = `${port.PrivatePort}/${port.Type}`;
        if (!portsMap.has(key)) {
          portsMap.set(key, {
            privatePort: port.PrivatePort,
            publicPort: port.PublicPort,
            type: port.Type,
          });
        }
      });

    const ports = Array.from(portsMap.values());

    // Get volumes
    let volumes = [];
    try {
      const containerDetails = await this.docker.getContainer(container.id).inspect();
      volumes = containerDetails.Mounts.filter(mount => mount.Type === 'volume').map(
        mount => mount.Name
      );
    } catch (error) {
      // Ignore volume errors
    }

    return {
      service: serviceName,
      status: container.state,
      health,
      ports,
      uptime,
      image: container.image,
      networkIp,
      volumes: volumes.slice(0, 2), // Limit to first 2 volumes for display
    };
  }

  // ===== COMPOSE OPERATIONS =====
  async executeComposeCommand(command, services = [], options = {}) {
    const composeFile = await this.generateCleanComposeFile(services);

    try {
      // Set required environment variables
      const env = {
        ...process.env,
        PROJECT_NAME: this.projectName,
        COMPOSE_PROJECT_NAME: this.projectName,
      };

      let cmd = `docker compose -p ${this.projectName} -f "${composeFile}" ${command}`;

      if (services.length > 0) {
        cmd += ` ${services.join(' ')}`;
      }

      const result = await platform.executeShellCommand(cmd, {
        stdio: options.stdio || 'inherit',
        onData: options.onData,
        onError: options.onError,
        env: env,
      });

      return result;
    } finally {
      // Cleanup temporary compose file
      try {
        await fs.unlink(composeFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async generateCleanComposeFile(services = []) {
    const timestamp = Date.now();
    const tempFile = path.join(os.tmpdir(), `infra-clean-compose-${timestamp}.yml`);

    const basePath = ConfigUtils.findDevToolsDirectory();

    // Check if we have custom configurations that need to be applied
    const hasCustomConfig = await this.hasCustomConfigForServices(services);

    if (hasCustomConfig) {
      // Generate a complete compose file with custom configurations
      return await this.generateCustomComposeFile(services, tempFile, basePath);
    } else {
      // Use the simple include-based approach for default configurations
      const composeContent = {
        include: CONFIG.COMPOSE_FILES.map(file => path.resolve(basePath, file)),

        networks: {
          'dev-tools-network': {
            driver: 'bridge',
            ipam: {
              config: [{ subnet: CONFIG.ENV_VARS.INFRA_NETWORK_SUBNET }],
            },
          },
        },

        volumes: CONFIG.VOLUMES.reduce((acc, volume) => {
          acc[volume] = { driver: 'local' };
          return acc;
        }, {}),
      };

      await fs.writeFile(tempFile, yaml.dump(composeContent));
      return tempFile;
    }
  }

  async hasCustomConfigForServices(services) {
    const configPath = path.resolve(__dirname, '../..', 'config', 'services.json');
    if (!fs.existsSync(configPath)) {
      return false;
    }

    try {
      const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return services.some(service => customConfig.services && customConfig.services[service]);
    } catch (error) {
      return false;
    }
  }

  async generateCustomComposeFile(services, tempFile, basePath) {
    // Load all original compose files and merge them
    const allServices = {};

    for (const composeFile of CONFIG.COMPOSE_FILES) {
      const filePath = path.resolve(basePath, composeFile);
      if (fs.existsSync(filePath)) {
        try {
          const content = yaml.load(fs.readFileSync(filePath, 'utf8'));
          if (content.services) {
            Object.assign(allServices, content.services);
          }
        } catch (error) {
          logger.warning(`Failed to load compose file ${composeFile}: ${error.message}`);
        }
      }
    }

    // Filter to only include the services we're starting
    const filteredServices = {};
    services.forEach(serviceName => {
      if (allServices[serviceName]) {
        filteredServices[serviceName] = { ...allServices[serviceName] };
      }
    });

    // Apply custom configurations
    const configPath = path.resolve(__dirname, '../..', 'config', 'services.json');
    if (fs.existsSync(configPath)) {
      try {
        const customConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        services.forEach(serviceName => {
          if (
            customConfig.services &&
            customConfig.services[serviceName] &&
            filteredServices[serviceName]
          ) {
            const serviceConfig = customConfig.services[serviceName];

            // Apply custom image
            if (serviceConfig.image) {
              filteredServices[serviceName].image = serviceConfig.image;
            }

            // Apply custom ports
            if (serviceConfig.ports && serviceConfig.ports.length > 0) {
              filteredServices[serviceName].ports = serviceConfig.ports.map(
                port => `${port}:${port}`
              );
            }

            // Apply custom environment variables
            if (serviceConfig.environment && Object.keys(serviceConfig.environment).length > 0) {
              filteredServices[serviceName].environment = {
                ...filteredServices[serviceName].environment,
                ...serviceConfig.environment,
              };
            }

            // Apply custom volumes
            if (serviceConfig.volumes && serviceConfig.volumes.length > 0) {
              const originalVolumes = filteredServices[serviceName].volumes || [];
              filteredServices[serviceName].volumes = originalVolumes.map((volumeMount, index) => {
                if (serviceConfig.volumes[index]) {
                  // Replace the volume name but keep the mount path
                  const mountPath = volumeMount.split(':')[1];
                  return `${serviceConfig.volumes[index]}:${mountPath}`;
                }
                return volumeMount;
              });
            }
          }
        });
      } catch (error) {
        logger.warning(`Failed to apply custom config: ${error.message}`);
      }
    }

    // Collect all volumes used by services (default + custom)
    const usedVolumes = new Set(CONFIG.VOLUMES);

    // Add custom volumes from service configurations
    const volumeConfigPath = path.resolve(__dirname, '../..', 'config', 'services.json');
    if (fs.existsSync(volumeConfigPath)) {
      try {
        const customConfig = JSON.parse(fs.readFileSync(volumeConfigPath, 'utf8'));
        services.forEach(serviceName => {
          if (
            customConfig.services &&
            customConfig.services[serviceName] &&
            customConfig.services[serviceName].volumes
          ) {
            customConfig.services[serviceName].volumes.forEach(volume => {
              usedVolumes.add(volume);
            });
          }
        });
      } catch (error) {
        // Ignore errors when collecting custom volumes
      }
    }

    const composeContent = {
      networks: {
        'dev-tools-network': {
          driver: 'bridge',
          ipam: {
            config: [{ subnet: CONFIG.ENV_VARS.INFRA_NETWORK_SUBNET }],
          },
        },
      },

      volumes: Array.from(usedVolumes).reduce((acc, volume) => {
        acc[volume] = { driver: 'local' };
        return acc;
      }, {}),

      services: filteredServices,
    };

    await fs.writeFile(tempFile, yaml.dump(composeContent));
    return tempFile;
  }

  async generateDynamicPortComposeFile(services) {
    const timestamp = Date.now();
    const tempFile = path.join(os.tmpdir(), `infra-dynamic-compose-${timestamp}.yml`);

    const basePath = ConfigUtils.findDevToolsDirectory();
    const composeContent = {
      include: CONFIG.COMPOSE_FILES.map(file => path.resolve(basePath, file)),

      networks: {
        'dev-tools-network': {
          driver: 'bridge',
          ipam: {
            config: [{ subnet: CONFIG.ENV_VARS.INFRA_NETWORK_SUBNET }],
          },
        },
      },

      volumes: CONFIG.VOLUMES.reduce((acc, volume) => {
        acc[volume] = { driver: 'local' };
        return acc;
      }, {}),

      services: {},
    };

    // Add dynamic port overrides
    for (const service of services) {
      const defaultPorts = ConfigUtils.getServicePorts(service);
      if (defaultPorts.length > 0) {
        composeContent.services[service] = {
          ports: [],
        };

        for (const port of defaultPorts) {
          const freePort = await platform.findFreePort(parseInt(port));
          composeContent.services[service].ports.push(`${freePort}:${port}`);
        }
      }
    }

    await fs.writeFile(tempFile, yaml.dump(composeContent));
    return tempFile;
  }

  // ===== PORT CONFLICT CHECKING =====
  async checkPortConflicts(services) {
    if (CONFIG.ENV_VARS.SKIP_PORT_CHECK) {
      logger.info('Skipping port conflict checking (SKIP_PORT_CHECK=true)');
      return { conflicts: [], hasConflicts: false };
    }

    logger.info('Checking for port conflicts with running services...');

    const conflicts = [];

    for (const service of services) {
      const ports = ConfigUtils.getServicePorts(service);
      const descriptions = ConfigUtils.getServiceDescriptions(service);

      for (let i = 0; i < ports.length; i++) {
        const port = parseInt(ports[i]);
        const desc = descriptions[i] || 'Unknown';

        const isFree = await platform.isPortFree(port);
        if (!isFree) {
          const processInfo = await platform.getPortProcessInfo(port);
          conflicts.push({
            service,
            port,
            description: desc,
            processInfo,
          });
        }
      }
    }

    return {
      conflicts,
      hasConflicts: conflicts.length > 0,
    };
  }

  // ===== VOLUME OPERATIONS =====
  async getVolumes(serviceFilter = null) {
    try {
      const volumes = await this.docker.listVolumes();

      return volumes.Volumes.filter(volume => {
        const isProjectVolume = volume.Name.startsWith(`${this.projectName}_`);

        if (!isProjectVolume) {
          return false;
        }

        if (serviceFilter) {
          return volume.Name.includes(`${this.projectName}_${serviceFilter}`);
        }

        return true;
      }).map(volume => ({
        name: volume.Name,
        driver: volume.Driver,
        mountpoint: volume.Mountpoint,
        scope: volume.Scope,
        labels: volume.Labels,
      }));
    } catch (error) {
      logger.error(`Failed to get volumes: ${error.message}`);
      return [];
    }
  }

  async removeVolume(volumeName) {
    try {
      const volume = this.docker.getVolume(volumeName);
      await volume.remove();
      return true;
    } catch (error) {
      logger.error(`Failed to remove volume ${volumeName}: ${error.message}`);
      return false;
    }
  }

  async inspectVolume(volumeName) {
    try {
      const volume = this.docker.getVolume(volumeName);
      return await volume.inspect();
    } catch (error) {
      logger.error(`Failed to inspect volume ${volumeName}: ${error.message}`);
      return null;
    }
  }

  // ===== HEALTH CHECKS =====
  async checkDockerConnection() {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      logger.error('Docker daemon is not running or not accessible');
      logger.info('Please ensure Docker Desktop is running and try again');
      return false;
    }
  }

  async validateServices(services) {
    const allServices = ConfigUtils.getAllServices();
    const invalidServices = services.filter(service => !allServices.includes(service));

    if (invalidServices.length > 0) {
      logger.error(`Invalid service(s): ${invalidServices.join(', ')}`);
      logger.info(`Available services: ${allServices.join(', ')}`);
      return false;
    }

    return true;
  }

  // ===== COMPOSE FILE OPERATIONS =====
  async validateComposeFiles() {
    const composeFiles = ConfigUtils.getComposeFilePaths();

    for (const file of composeFiles) {
      if (!(await fs.pathExists(file))) {
        logger.error(`Compose file not found: ${file}`);
        return false;
      }
    }

    return true;
  }

  // ===== UTILITY METHODS =====
  getStatusIcon(status, health) {
    if (status === 'running') {
      if (health === 'healthy') {
        return '🟢';
      }
      if (health === 'unhealthy') {
        return '🟡';
      }
      return '🟢';
    }

    if (status === 'restarting') {
      return '🟡';
    }

    return '⚫'; // stopped
  }

  formatUptime(uptime) {
    if (!uptime) {
      return '-';
    }
    return uptime.replace(/About /, '~');
  }

  formatPorts(ports) {
    if (!ports || ports.length === 0) {
      return '-';
    }

    // Remove duplicates and filter out undefined ports
    const uniquePorts = [
      ...new Set(ports.filter(port => port.publicPort).map(port => port.publicPort)),
    ].slice(0, 2); // Limit to first 2 unique ports

    return uniquePorts.join(', ');
  }

  formatVolumes(volumes) {
    if (!volumes || volumes.length === 0) {
      return '-';
    }

    const formatted = volumes
      .slice(0, 2) // Limit to first 2 volumes
      .join(',');

    return formatted.length > 50 ? formatted.substring(0, 50) : formatted;
  }
}

module.exports = new DockerService();
