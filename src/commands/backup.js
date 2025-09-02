// ===== IMPORTS & DEPENDENCIES =====
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const Table = require('cli-table3');
const docker = require('../services/docker');
const logger = require('../utils/logger');
const platform = require('../utils/platform');
const { CONFIG, ConfigUtils } = require('../utils/config');

// ===== BACKUP COMMAND IMPLEMENTATION =====
class BackupCommand {
  static async execute(volumes, _options) {
    // Check Docker connection first
    if (!(await docker.checkDockerConnection())) {
      return;
    }

    logger.header('Backing Up Volumes');

    // Ensure backup directory exists
    const backupDir = ConfigUtils.getBackupDir();
    await fs.ensureDir(backupDir);

    const timestamp = ConfigUtils.getTimestamp();

    if (!volumes || volumes.length === 0) {
      // Full backup of all volumes
      await this.createFullBackup(backupDir, timestamp);
    } else {
      // Selective backup of specified volumes
      await this.createSelectiveBackup(volumes, backupDir, timestamp);
    }
  }

  static async createFullBackup(backupDir, timestamp) {
    const backupFile = path.join(backupDir, `full_backup_${timestamp}.tar.gz`);

    logger.info(`Creating full backup: ${backupFile}`);

    const spinner = ora('Creating backup archive...').start();

    try {
      // Build docker run command for full backup
      const volumeMounts = CONFIG.VOLUMES.map(
        volume => `-v "${CONFIG.PROJECT_NAME}_${volume}:/data/${volume.replace('-data', '')}:ro"`
      ).join(' ');

      const backupPath = platform.getVolumePathFormat(backupDir);

      const command = `docker run --rm ${volumeMounts} -v "${backupPath}:/backup" alpine:latest tar czf "/backup/full_backup_${timestamp}.tar.gz" -C /data .`;

      await platform.executeShellCommand(command);

      spinner.succeed(`Full backup created: ${backupFile}`);

      // Show backup size
      const stats = await fs.stat(backupFile);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      logger.info(`Backup size: ${sizeInMB} MB`);
    } catch (error) {
      spinner.fail(`Backup failed: ${error.message}`);
      throw error;
    }
  }

  static async createSelectiveBackup(volumeNames, backupDir, timestamp) {
    const backupFile = path.join(backupDir, `selective_backup_${timestamp}.tar.gz`);

    logger.info(`Creating selective backup: ${backupFile}`);

    const spinner = ora('Validating volumes...').start();

    // Validate and build volume mounts
    const volumeMounts = [];
    let validVolumeCount = 0;

    for (const volumeName of volumeNames) {
      let fullVolumeName = volumeName;

      // Handle service names vs full volume names
      if (!volumeName.includes('_')) {
        fullVolumeName = ConfigUtils.getVolumeName(volumeName);
      }

      // Check if volume exists
      const volumeInfo = await docker.inspectVolume(fullVolumeName);
      if (volumeInfo) {
        const shortName = volumeName.includes('_')
          ? volumeName.split('_')[1].replace('-data', '')
          : volumeName;
        volumeMounts.push(`-v "${fullVolumeName}:/data/${shortName}:ro"`);
        validVolumeCount++;
        logger.info(`Adding volume to backup: ${fullVolumeName}`);
      } else {
        logger.warning(`Volume not found, skipping: ${fullVolumeName}`);
      }
    }

    if (validVolumeCount === 0) {
      spinner.fail('No valid volumes found to backup!');
      return;
    }

    spinner.text = 'Creating backup archive...';

    try {
      const backupPath = platform.getVolumePathFormat(backupDir);
      const command = `docker run --rm ${volumeMounts.join(' ')} -v "${backupPath}:/backup" alpine:latest tar czf "/backup/selective_backup_${timestamp}.tar.gz" -C /data .`;

      await platform.executeShellCommand(command);

      spinner.succeed(`Selective backup created: ${backupFile}`);

      // Show backup size
      const stats = await fs.stat(backupFile);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      logger.info(`Backup size: ${sizeInMB} MB (${validVolumeCount} volumes)`);
    } catch (error) {
      spinner.fail(`Backup failed: ${error.message}`);
      throw error;
    }
  }

  static async listBackups() {
    const backupDir = ConfigUtils.getBackupDir();

    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(file => file.endsWith('.tar.gz'));

      if (backupFiles.length === 0) {
        logger.info('No backup files found');
        return;
      }

      logger.header('Available Backups');

      const table = new Table({
        head: ['BACKUP FILE', 'SIZE', 'CREATED'],
        style: {
          head: ['cyan'],
          border: ['grey'],
          compact: false,
        },
        colWidths: [35, 12, 20],
      });

      for (const file of backupFiles.sort().reverse()) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        const created =
          stats.birthtime.toLocaleDateString() + ' ' + stats.birthtime.toLocaleTimeString();

        table.push([file, `${sizeInMB} MB`, created]);
      }

      console.log(table.toString());
    } catch (error) {
      logger.error(`Failed to list backups: ${error.message}`);
    }
  }
}

module.exports = BackupCommand;
