// ===== IMPORTS & DEPENDENCIES =====
const VolumesCommand = require('../src/commands/volumes');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');
const platform = require('../src/utils/platform');
const { ConfigUtils } = require('../src/utils/config');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/platform');
jest.mock('../src/utils/config');
jest.mock('inquirer');
jest.mock('fs');
jest.mock('ora');

// ===== VOLUMES COMMAND TESTS =====
describe('VolumesCommand', () => {
  let mockSpinner;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock docker service
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.getVolumes = jest.fn().mockResolvedValue([
      { name: 'infra_postgres-data', driver: 'local', mountpoint: '/var/lib/docker/volumes/infra_postgres-data/_data' },
      { name: 'infra_redis-data', driver: 'local', mountpoint: '/var/lib/docker/volumes/infra_redis-data/_data' }
    ]);
    docker.inspectVolume = jest.fn().mockResolvedValue({
      Name: 'infra_postgres-data',
      Driver: 'local',
      Mountpoint: '/var/lib/docker/volumes/infra_postgres-data/_data',
      Labels: {},
      Scope: 'local'
    });
    docker.removeVolume = jest.fn().mockResolvedValue(true);

    // Mock ConfigUtils
    ConfigUtils.getVolumeName = jest.fn().mockImplementation(service => `infra_${service}-data`);

    // Mock platform
    platform.executeShellCommand = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
    platform.isWindows = false;

    // Mock fs
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.mkdirSync = jest.fn();
    fs.statSync = jest.fn().mockReturnValue({ size: 1024 * 1024 * 10 }); // 10 MB

    // Mock ora spinner
    mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn().mockReturnThis(),
      fail: jest.fn().mockReturnThis(),
      text: ''
    };
    require('ora').mockReturnValue(mockSpinner);

    // Mock console.log to avoid clutter in test output
    console.log = jest.fn();
  });

  describe('execute (show)', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await VolumesCommand.execute(null, {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should show all volumes when no service specified', async () => {
      await VolumesCommand.execute(null, {});

      expect(logger.header).toHaveBeenCalledWith('Volume Usage');
      expect(docker.getVolumes).toHaveBeenCalledWith(null);
      expect(console.log).toHaveBeenCalled();
    });

    test('should show volumes for specific service', async () => {
      await VolumesCommand.execute('postgres', {});

      expect(docker.getVolumes).toHaveBeenCalledWith('postgres');
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle no volumes found', async () => {
      docker.getVolumes.mockResolvedValue([]);

      await VolumesCommand.execute(null, {});

      expect(logger.info).toHaveBeenCalledWith('No project volumes found');
    });

    test('should handle no volumes found for specific service', async () => {
      docker.getVolumes.mockResolvedValue([]);

      await VolumesCommand.execute('postgres', {});

      expect(logger.info).toHaveBeenCalledWith('No volumes found for service: postgres');
    });
  });

  describe('list', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await VolumesCommand.list(null, {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should list all volumes when no service specified', async () => {
      await VolumesCommand.list(null, {});

      expect(logger.header).toHaveBeenCalledWith('Project Volumes');
      expect(docker.getVolumes).toHaveBeenCalledWith(null);
      expect(logger.info).toHaveBeenCalledWith('All project volumes:');
    });

    test('should list volumes for specific service', async () => {
      await VolumesCommand.list('postgres', {});

      expect(docker.getVolumes).toHaveBeenCalledWith('postgres');
      expect(logger.info).toHaveBeenCalledWith('Volumes for service: postgres');
    });

    test('should handle no volumes found', async () => {
      docker.getVolumes.mockResolvedValue([]);

      await VolumesCommand.list(null, {});

      expect(logger.info).toHaveBeenCalledWith('No project volumes found');
    });
  });

  describe('inspect', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await VolumesCommand.inspect('postgres', {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should return error if no volume specified', async () => {
      await VolumesCommand.inspect(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a volume to inspect');
    });

    test('should inspect volume by service name', async () => {
      await VolumesCommand.inspect('postgres', {});

      expect(ConfigUtils.getVolumeName).toHaveBeenCalledWith('postgres');
      expect(docker.inspectVolume).toHaveBeenCalledWith('infra_postgres-data');
      expect(console.log).toHaveBeenCalled();
    });

    test('should inspect volume by full volume name', async () => {
      await VolumesCommand.inspect('infra_postgres-data', {});

      expect(docker.inspectVolume).toHaveBeenCalledWith('infra_postgres-data');
      expect(console.log).toHaveBeenCalled();
    });

    test('should handle volume not found', async () => {
      docker.inspectVolume.mockResolvedValue(null);

      await VolumesCommand.inspect('postgres', {});

      expect(logger.error).toHaveBeenCalledWith('Volume not found: infra_postgres-data');
      expect(logger.info).toHaveBeenCalledWith('Available volumes:');
    });
  });

  describe('remove', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await VolumesCommand.remove('postgres', {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should return error if no volume specified', async () => {
      await VolumesCommand.remove(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a volume to remove');
    });

    test('should handle volume not found', async () => {
      docker.inspectVolume.mockResolvedValue(null);

      await VolumesCommand.remove('postgres', {});

      expect(logger.error).toHaveBeenCalledWith('Volume not found: infra_postgres-data');
    });

    test('should remove volume with confirmation', async () => {
      inquirer.prompt = jest.fn().mockResolvedValue({ confirmRemoval: true });

      await VolumesCommand.remove('postgres', {});

      expect(logger.warning).toHaveBeenCalledWith('This will permanently delete the volume and all its data!');
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(docker.removeVolume).toHaveBeenCalledWith('infra_postgres-data');
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    test('should cancel removal when user declines', async () => {
      inquirer.prompt = jest.fn().mockResolvedValue({ confirmRemoval: false });

      await VolumesCommand.remove('postgres', {});

      expect(docker.removeVolume).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Volume removal cancelled');
    });

    test('should handle removal failure', async () => {
      inquirer.prompt = jest.fn().mockResolvedValue({ confirmRemoval: true });
      docker.removeVolume.mockResolvedValue(false);

      await VolumesCommand.remove('postgres', {});

      expect(mockSpinner.fail).toHaveBeenCalled();
    });
  });

  describe('backup', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await VolumesCommand.backup('postgres', {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should return error if no volume specified', async () => {
      await VolumesCommand.backup(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a volume to backup');
    });

    test('should handle volume not found', async () => {
      docker.inspectVolume.mockResolvedValue(null);

      await VolumesCommand.backup('postgres', {});

      expect(logger.error).toHaveBeenCalledWith('Volume not found: infra_postgres-data');
    });

    test('should backup volume with user-provided path', async () => {
      inquirer.prompt = jest.fn().mockResolvedValue({ backupPath: './backups' });
      fs.existsSync.mockImplementation((path) => {
        // Return false for initial directory check, true for backup file verification
        return path.includes('.tar.gz');
      });

      await VolumesCommand.backup('postgres', {});

      expect(logger.header).toHaveBeenCalledWith('Volume Backup: infra_postgres-data');
      expect(inquirer.prompt).toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(platform.executeShellCommand).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    test('should use existing backup directory', async () => {
      inquirer.prompt = jest.fn().mockResolvedValue({ backupPath: './backups' });
      fs.existsSync.mockReturnValue(true);

      await VolumesCommand.backup('postgres', {});

      expect(fs.mkdirSync).not.toHaveBeenCalled();
      expect(platform.executeShellCommand).toHaveBeenCalled();
    });

    test('should handle backup failure', async () => {
      inquirer.prompt = jest.fn().mockResolvedValue({ backupPath: './backups' });
      platform.executeShellCommand.mockRejectedValue(new Error('Backup failed'));

      await VolumesCommand.backup('postgres', {});

      expect(mockSpinner.fail).toHaveBeenCalled();
    });

    test('should handle directory creation failure', async () => {
      inquirer.prompt = jest.fn().mockResolvedValue({ backupPath: './backups' });
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await VolumesCommand.backup('postgres', {});

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create backup directory'));
    });
  });

  describe('restore', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await VolumesCommand.restore('postgres', {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should return error if no volume specified', async () => {
      await VolumesCommand.restore(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a volume to restore');
    });

    test('should restore volume from archive with confirmation', async () => {
      inquirer.prompt = jest.fn()
        .mockResolvedValueOnce({ archivePath: './backups/infra_postgres-data_2025-10-28.tar.gz' })
        .mockResolvedValueOnce({ confirmRestore: true });

      platform.executeShellCommand.mockResolvedValue({ stdout: '' });

      await VolumesCommand.restore('postgres', {});

      expect(logger.header).toHaveBeenCalledWith('Volume Restore: infra_postgres-data');
      expect(logger.warning).toHaveBeenCalledWith(expect.stringContaining('WARNING'));
      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
      expect(platform.executeShellCommand).toHaveBeenCalledTimes(3); // check containers + clear + restore
      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    test('should cancel restore when user declines', async () => {
      inquirer.prompt = jest.fn()
        .mockResolvedValueOnce({ archivePath: './backups/infra_postgres-data_2025-10-28.tar.gz' })
        .mockResolvedValueOnce({ confirmRestore: false });

      platform.executeShellCommand.mockResolvedValue({ stdout: '' });

      await VolumesCommand.restore('postgres', {});

      expect(logger.info).toHaveBeenCalledWith('Restore cancelled');
      // Only 1 call - checking for containers using the volume
      expect(platform.executeShellCommand).toHaveBeenCalledTimes(1);
    });

    test('should create volume if it does not exist', async () => {
      docker.inspectVolume.mockResolvedValue(null);
      inquirer.prompt = jest.fn()
        .mockResolvedValueOnce({ archivePath: './backups/infra_postgres-data_2025-10-28.tar.gz' })
        .mockResolvedValueOnce({ confirmRestore: true });

      platform.executeShellCommand.mockResolvedValue({ stdout: '' });

      await VolumesCommand.restore('postgres', {});

      expect(logger.warning).toHaveBeenCalledWith('Volume does not exist: infra_postgres-data');
      expect(platform.executeShellCommand).toHaveBeenCalledWith(
        expect.stringContaining('docker volume create infra_postgres-data')
      );
    });

    test('should handle restore failure', async () => {
      inquirer.prompt = jest.fn()
        .mockResolvedValueOnce({ archivePath: './backups/infra_postgres-data_2025-10-28.tar.gz' })
        .mockResolvedValueOnce({ confirmRestore: true });

      platform.executeShellCommand.mockRejectedValue(new Error('Restore failed'));

      await VolumesCommand.restore('postgres', {});

      expect(mockSpinner.fail).toHaveBeenCalled();
    });

    test('should accept .tar.gz archive files', async () => {
      inquirer.prompt = jest.fn()
        .mockResolvedValueOnce({ archivePath: './backups/infra_postgres-data_2025-10-28.tar.gz' })
        .mockResolvedValueOnce({ confirmRestore: true });

      platform.executeShellCommand.mockResolvedValue({ stdout: '' });

      await VolumesCommand.restore('postgres', {});

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });

    test('should accept .tgz archive files', async () => {
      inquirer.prompt = jest.fn()
        .mockResolvedValueOnce({ archivePath: './backups/infra_postgres-data_2025-10-28.tgz' })
        .mockResolvedValueOnce({ confirmRestore: true });

      platform.executeShellCommand.mockResolvedValue({ stdout: '' });

      await VolumesCommand.restore('postgres', {});

      expect(mockSpinner.succeed).toHaveBeenCalled();
    });
  });
});
