// ===== IMPORTS & DEPENDENCIES =====
const Table = require('cli-table3');
const docker = require('../services/docker');
const logger = require('../utils/logger');
// platform import removed - not used
const { ConfigUtils } = require('../utils/config');

// ===== STATUS COMMAND IMPLEMENTATION =====
class StatusCommand {
  static async execute(service, options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header(`Infra-Tools Dashboard${options.active ? ' (Active Services Only)' : ''}`);

    if (service) {
      // Show specific service
      await this.showSingleService(service, options);
    } else {
      // Show all services
      await this.showAllServices(options);
    }
  }

  static async showSingleService(serviceName, options) {
    // Validate service name
    if (!ConfigUtils.isValidService(serviceName)) {
      logger.error(`Service '${serviceName}' not found`);
      logger.info(`Available services: ${ConfigUtils.getAllServices().join(', ')}`);
      return;
    }

    const serviceStatus = await docker.getServiceStatus(serviceName);

    if (options.json) {
      console.log(JSON.stringify(serviceStatus, null, 2));
    } else {
      this.displayServiceTable([serviceStatus], options);
    }
  }

  static async showAllServices(options) {
    const allServices = ConfigUtils.getAllServices().sort();
    const serviceStatuses = [];

    // Get status for all services
    for (const service of allServices) {
      const status = await docker.getServiceStatus(service);
      serviceStatuses.push(status);
    }

    // Filter active services if requested
    let servicesToShow = serviceStatuses;
    if (options.active) {
      servicesToShow = serviceStatuses.filter(status => status.status === 'running');
    }

    if (options.json) {
      console.log(JSON.stringify(servicesToShow, null, 2));
    } else {
      this.displayServiceTable(servicesToShow, options);
      this.showSummary(serviceStatuses, options.active);
    }
  }

  static displayServiceTable(services, _options) {
    if (services.length === 0) {
      logger.info('💤 No services found');
      return;
    }

    // Sort services: running first, then stopped (both alphabetically)
    const runningSvcs = services
      .filter(s => s.status === 'running')
      .sort((a, b) => (a.service || '').localeCompare(b.service || ''));
    const stoppedSvcs = services
      .filter(s => s.status !== 'running')
      .sort((a, b) => (a.service || '').localeCompare(b.service || ''));
    const sortedServices = [...runningSvcs, ...stoppedSvcs];

    // Create table with fixed styling
    const table = new Table({
      head: ['', 'SERVICE', 'IMAGE', 'VOLUMES', 'NETWORK-IP', 'PORTS', 'UPTIME'],
      style: {
        head: ['cyan'],
        border: ['grey'],
        compact: false,
      },
      colWidths: [5, 15, 35, 32, 14, 18, 12],
    });

    // Populate table rows
    sortedServices.forEach(service => {
      const statusIcon = docker.getStatusIcon(service.status, service.health);
      const image = this.formatImage(service.image);
      const volumes = docker.formatVolumes(service.volumes);
      const networkIp = service.networkIp || '-';
      const ports = docker.formatPorts(service.ports);
      const uptime = docker.formatUptime(service.uptime);

      table.push([statusIcon, service.service, image, volumes, networkIp, ports, uptime]);
    });

    console.log(table.toString());
  }

  static formatImage(image) {
    if (!image) {
      return '-';
    }

    // Remove registry prefix and truncate if needed
    const cleanImage = image.replace(/.*\//, '');
    return cleanImage.length > 32 ? cleanImage.substring(0, 29) + '...' : cleanImage;
  }

  static showSummary(allServices, activeOnly) {
    const running = allServices.filter(s => s.status === 'running').length;
    const total = allServices.length;
    const stopped = total - running;

    console.log(); // Empty line

    if (activeOnly) {
      if (running === 0) {
        logger.info("💤 No active services found. Run 'infra-tools start' to launch services.");
      } else {
        logger.success(`🚀 ${running} active service(s) running!`);
      }
    } else {
      if (running === 0) {
        logger.info("💤 All services stopped. Run 'infra-tools start' to launch services.");
      } else if (running === total) {
        logger.success(`🚀 All ${total} services running! System is healthy.`);
      } else {
        logger.info(`⚡ ${running}/${total} services running. ${stopped} stopped.`);
      }
    }
  }
}

module.exports = StatusCommand;
