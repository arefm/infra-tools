// ===== IMPORTS & DEPENDENCIES =====
const Table = require('cli-table3');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const { ConfigUtils } = require('../utils/config');

// ===== PORTS COMMAND IMPLEMENTATION =====
class PortsCommand {
  static async execute(_options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Port Mappings');

    // Get all running containers
    const containers = await docker.getContainers();
    const runningContainers = containers.filter(c => c.state === 'running');

    if (runningContainers.length === 0) {
      logger.info('No running services found.');
      console.log();
      logger.info('Start services with: infra-tools start [services...]');
      return;
    }

    console.log();
    logger.info('Current port assignments for running services:');

    // Create table for port mappings
    const table = new Table({
      head: ['SERVICE', 'CONTAINER PORTS', 'HOST PORTS', 'DESCRIPTION'],
      style: {
        head: ['cyan'],
        border: ['grey'],
        compact: false,
      },
      colWidths: [15, 20, 15, 25],
    });

    // Get detailed port information for each running service
    for (const container of runningContainers) {
      const serviceStatus = await docker.getServiceStatus(container.serviceName);

      if (serviceStatus.ports.length > 0) {
        const containerPorts = serviceStatus.ports
          .map(p => `${p.privatePort}/${p.type}`)
          .join(', ');
        const hostPorts = serviceStatus.ports.map(p => p.publicPort).join(', ');

        // Get service descriptions
        const descriptions = ConfigUtils.getServiceDescriptions(container.serviceName);
        const description = descriptions.join(', ') || 'N/A';

        table.push([container.serviceName, containerPorts, hostPorts, description]);
      }
    }

    if (table.length > 0) {
      console.log(table.toString());
      console.log();
      logger.info('Access services at localhost:[host_port]');
    } else {
      logger.info('No port mappings found for running services');
    }
  }
}

module.exports = PortsCommand;
