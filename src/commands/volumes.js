// ===== IMPORTS & DEPENDENCIES =====
const Table = require('cli-table3');
const inquirer = require('inquirer');
const ora = require('ora');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const platform = require('../utils/platform');
const { ConfigUtils } = require('../utils/config');

// ===== VOLUMES COMMAND IMPLEMENTATION =====
class VolumesCommand {
  static async execute(service, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Volume Usage');

    const volumes = await docker.getVolumes(service);

    if (volumes.length === 0) {
      if (service) {
        logger.info(`No volumes found for service: ${service}`);
      } else {
        logger.info('No project volumes found');
      }
      return;
    }

    // Create volumes table
    const table = new Table({
      head: ['VOLUME NAME', 'DRIVER', 'SIZE', 'MOUNT POINT'],
      style: {
        head: ['cyan'],
        border: ['grey'],
        compact: false,
      },
      colWidths: [30, 10, 15, 50],
    });

    // Get volume details with size information
    for (const volume of volumes) {
      let size = 'Unknown';
      let mountPoint = volume.mountpoint || 'N/A';

      try {
        // Get volume size using docker system df
        const { stdout } = await platform.executeShellCommand(
          'docker system df -v --format "table {{.Name}}\\t{{.Size}}"'
        );
        const lines = stdout.split('\n');
        const volumeLine = lines.find(line => line.includes(volume.name));
        if (volumeLine) {
          const parts = volumeLine.split('\t');
          if (parts.length > 1) {
            size = parts[1].trim();
          }
        }
      } catch (error) {
        // Ignore size calculation errors
      }

      // Truncate mount point if too long
      if (mountPoint.length > 47) {
        mountPoint = '...' + mountPoint.substring(mountPoint.length - 44);
      }

      table.push([volume.name, volume.driver, size, mountPoint]);
    }

    console.log(table.toString());

    // Show system disk usage
    console.log();
    try {
      logger.info('Docker system disk usage:');
      await platform.executeShellCommand('docker system df', { stdio: 'inherit' });
    } catch (error) {
      logger.warning('Could not retrieve system disk usage');
    }
  }

  static async list(service, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Project Volumes');

    const volumes = await docker.getVolumes(service);

    if (volumes.length === 0) {
      if (service) {
        logger.info(`No volumes found for service: ${service}`);
      } else {
        logger.info('No project volumes found');
      }
      return;
    }

    if (service) {
      logger.info(`Volumes for service: ${service}`);
    } else {
      logger.info('All project volumes:');
    }

    // Show detailed volume list
    try {
      const volumeNames = volumes.map(v => v.name).join(' ');
      await platform.executeShellCommand(
        `docker volume ls --format "table {{.Name}}\\t{{.Driver}}\\t{{.Mountpoint}}" | grep -E "(DRIVER|${volumeNames.replace(/ /g, '|')})"`,
        {
          stdio: 'inherit',
        }
      );
    } catch (error) {
      // Fallback to simple listing
      volumes.forEach(volume => {
        logger.plain(`${volume.name}\t${volume.driver}\t${volume.mountpoint || 'N/A'}`);
      });
    }
  }

  static async inspect(volumeName, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!volumeName) {
      logger.error('Please specify a volume to inspect');
      return;
    }

    // Handle both service names and full volume names
    let fullVolumeName = volumeName;
    if (!volumeName.includes('_')) {
      fullVolumeName = ConfigUtils.getVolumeName(volumeName);
    }

    logger.header(`Volume Inspection: ${fullVolumeName}`);

    const volumeInfo = await docker.inspectVolume(fullVolumeName);

    if (volumeInfo) {
      console.log(JSON.stringify(volumeInfo, null, 2));
    } else {
      logger.error(`Volume not found: ${fullVolumeName}`);
      console.log();
      logger.info('Available volumes:');
      const volumes = await docker.getVolumes();
      volumes.forEach(volume => {
        logger.plain(`  • ${volume.name}`);
      });
    }
  }

  static async remove(volumeName, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!volumeName) {
      logger.error('Please specify a volume to remove');
      return;
    }

    // Handle both service names and full volume names
    let fullVolumeName = volumeName;
    if (!volumeName.includes('_')) {
      fullVolumeName = ConfigUtils.getVolumeName(volumeName);
    }

    logger.header(`Volume Removal: ${fullVolumeName}`);

    // Check if volume exists
    const volumeInfo = await docker.inspectVolume(fullVolumeName);
    if (!volumeInfo) {
      logger.error(`Volume not found: ${fullVolumeName}`);
      return;
    }

    logger.warning('This will permanently delete the volume and all its data!');

    const { confirmRemoval } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRemoval',
        message: `Are you sure you want to remove '${fullVolumeName}'?`,
        default: false,
      },
    ]);

    if (confirmRemoval) {
      const spinner = ora(`Removing volume: ${fullVolumeName}`).start();

      try {
        const success = await docker.removeVolume(fullVolumeName);
        if (success) {
          spinner.succeed(`Volume removed: ${fullVolumeName}`);
        } else {
          spinner.fail(`Failed to remove volume: ${fullVolumeName}`);
        }
      } catch (error) {
        spinner.fail(`Error removing volume: ${error.message}`);
      }
    } else {
      logger.info('Volume removal cancelled');
    }
  }
}

module.exports = VolumesCommand;
