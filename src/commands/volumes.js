// ===== IMPORTS & DEPENDENCIES =====
const Table = require('cli-table3');
const inquirer = require('inquirer');
const ora = require('ora');
const path = require('path');
const fs = require('fs');
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

  static async backup(volumeName, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!volumeName) {
      logger.error('Please specify a volume to backup');
      return;
    }

    // Handle both service names and full volume names
    let fullVolumeName = volumeName;
    if (!volumeName.includes('_')) {
      fullVolumeName = ConfigUtils.getVolumeName(volumeName);
    }

    logger.header(`Volume Backup: ${fullVolumeName}`);

    // Check if volume exists
    const volumeInfo = await docker.inspectVolume(fullVolumeName);
    if (!volumeInfo) {
      logger.error(`Volume not found: ${fullVolumeName}`);
      return;
    }

    // Prompt for backup path
    const { backupPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'backupPath',
        message: 'Enter the backup path (directory where archive will be saved):',
        default: './backups',
        validate: input => {
          if (!input || input.trim() === '') {
            return 'Backup path cannot be empty';
          }
          return true;
        },
      },
    ]);

    // Resolve and create backup directory
    const resolvedPath = path.resolve(backupPath);
    if (!fs.existsSync(resolvedPath)) {
      try {
        fs.mkdirSync(resolvedPath, { recursive: true });
        logger.info(`Created backup directory: ${resolvedPath}`);
      } catch (error) {
        logger.error(`Failed to create backup directory: ${error.message}`);
        return;
      }
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFileName = `${fullVolumeName}_${timestamp}.tar.gz`;
    const backupFilePath = path.join(resolvedPath, backupFileName);

    logger.info(`Backup will be saved to: ${backupFilePath}`);

    const spinner = ora('Creating backup archive...').start();

    try {
      // Use a temporary container to create tar.gz archive of the volume
      // Docker run command: mount volume, tar contents, output to host
      const normalizedBackupPath = platform.isWindows()
        ? backupFilePath.replace(/\\/g, '/')
        : backupFilePath;

      const command = `docker run --rm -v ${fullVolumeName}:/volume -v "${path.dirname(normalizedBackupPath)}:/backup" alpine tar czf /backup/${path.basename(backupFileName)} -C /volume .`;

      await platform.executeShellCommand(command);

      // Verify backup file was created
      if (fs.existsSync(backupFilePath)) {
        const stats = fs.statSync(backupFilePath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        spinner.succeed(`Backup created successfully: ${backupFilePath} (${fileSizeMB} MB)`);
      } else {
        spinner.fail('Backup file was not created');
      }
    } catch (error) {
      spinner.fail(`Backup failed: ${error.message}`);
      logger.error('Make sure Docker is running and the volume is accessible');
    }
  }

  static async restore(volumeName, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    if (!volumeName) {
      logger.error('Please specify a volume to restore');
      return;
    }

    // Handle both service names and full volume names
    let fullVolumeName = volumeName;
    if (!volumeName.includes('_')) {
      fullVolumeName = ConfigUtils.getVolumeName(volumeName);
    }

    logger.header(`Volume Restore: ${fullVolumeName}`);

    // Check if volume exists
    const volumeInfo = await docker.inspectVolume(fullVolumeName);
    if (!volumeInfo) {
      logger.warning(`Volume does not exist: ${fullVolumeName}`);
      logger.info('A new volume will be created during restore.');
    }

    // Prompt for archive path
    const { archivePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'archivePath',
        message: 'Enter the path to the backup archive (.tar.gz file):',
        validate: input => {
          if (!input || input.trim() === '') {
            return 'Archive path cannot be empty';
          }
          const resolvedPath = path.resolve(input);
          if (!fs.existsSync(resolvedPath)) {
            return `File not found: ${resolvedPath}`;
          }
          if (!input.endsWith('.tar.gz') && !input.endsWith('.tgz')) {
            return 'Archive must be a .tar.gz or .tgz file';
          }
          return true;
        },
      },
    ]);

    const resolvedArchivePath = path.resolve(archivePath);

    // Warning about data loss
    logger.warning('⚠️  WARNING: This will REPLACE all existing data in the volume!');

    // Check if any containers are using this volume
    try {
      const { stdout } = await platform.executeShellCommand(
        `docker ps -a --filter volume=${fullVolumeName} --format "{{.Names}}"`
      );

      if (stdout.trim()) {
        const containers = stdout.trim().split('\n');
        logger.warning(`The following containers are using this volume:`);
        containers.forEach(container => logger.plain(`  • ${container}`));
        logger.info('Consider stopping these containers before restoring.');
      }
    } catch (error) {
      // Ignore errors checking for containers
    }

    const { confirmRestore } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRestore',
        message: `Are you sure you want to restore '${fullVolumeName}' from the backup?`,
        default: false,
      },
    ]);

    if (!confirmRestore) {
      logger.info('Restore cancelled');
      return;
    }

    const spinner = ora('Restoring volume from backup...').start();

    try {
      // If volume doesn't exist, create it
      if (!volumeInfo) {
        spinner.text = 'Creating volume...';
        await platform.executeShellCommand(`docker volume create ${fullVolumeName}`);
      }

      // Clear existing volume data
      spinner.text = 'Clearing existing volume data...';
      const clearCommand = `docker run --rm -v ${fullVolumeName}:/volume alpine sh -c "rm -rf /volume/* /volume/..?* /volume/.[!.]* 2>/dev/null || true"`;
      await platform.executeShellCommand(clearCommand);

      // Restore from archive
      spinner.text = 'Extracting backup archive...';
      const normalizedArchivePath = platform.isWindows()
        ? resolvedArchivePath.replace(/\\/g, '/')
        : resolvedArchivePath;

      const restoreCommand = `docker run --rm -v ${fullVolumeName}:/volume -v "${path.dirname(normalizedArchivePath)}:/backup" alpine tar xzf /backup/${path.basename(resolvedArchivePath)} -C /volume`;

      await platform.executeShellCommand(restoreCommand);

      spinner.succeed(`Volume restored successfully: ${fullVolumeName}`);
      logger.info('The volume has been restored from the backup archive.');
    } catch (error) {
      spinner.fail(`Restore failed: ${error.message}`);
      logger.error('Make sure Docker is running and the archive is valid');
    }
  }
}

module.exports = VolumesCommand;
