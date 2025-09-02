// ===== IMPORTS & DEPENDENCIES =====
const ShellCommand = require('../src/commands/shell');
const InspectCommand = require('../src/commands/inspect');
const PortsCommand = require('../src/commands/ports');
const RestartCommand = require('../src/commands/restart');
const CleanCommand = require('../src/commands/clean');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');
const { ConfigUtils } = require('../src/utils/config');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/config');
jest.mock('ora');

describe('Command Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.validateServices = jest.fn().mockResolvedValue(true);
    docker.getServiceStatus = jest.fn().mockResolvedValue({ status: 'running' });
    docker.executeComposeCommand = jest.fn().mockResolvedValue();
    docker.checkPortConflicts = jest.fn().mockResolvedValue({ conflicts: [], hasConflicts: false });
    docker.getContainers = jest.fn().mockResolvedValue([]);
    
    ConfigUtils.getAllServices = jest.fn().mockReturnValue(['postgres', 'redis']);
    ConfigUtils.getContainerName = jest.fn().mockReturnValue('infra_postgres');
    
    // Mock ora spinner
    const mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn(),
      fail: jest.fn()
    };
    require('ora').mockReturnValue(mockSpinner);
  });

  describe('ShellCommand', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await ShellCommand.execute('postgres', {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(docker.validateServices).not.toHaveBeenCalled();
    });

    test('should return error if no service specified', async () => {
      await ShellCommand.execute(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a service for shell access');
    });

    test('should execute shell command for running service', async () => {
      await ShellCommand.execute('postgres', {});

      expect(docker.executeComposeCommand).toHaveBeenCalledWith('exec postgres bash', [], {
        stdio: 'inherit'
      });
    });
  });

  describe('RestartCommand', () => {
    test('should restart specific services', async () => {
      await RestartCommand.execute(['postgres'], {});

      expect(logger.header).toHaveBeenCalledWith('Restarting Services');
      expect(docker.validateServices).toHaveBeenCalledWith(['postgres']);
      expect(docker.executeComposeCommand).toHaveBeenCalledWith('restart', ['postgres']);
    });

    test('should restart all services when none specified', async () => {
      await RestartCommand.execute([], {});

      expect(ConfigUtils.getAllServices).toHaveBeenCalled();
      expect(docker.executeComposeCommand).toHaveBeenCalledWith('restart');
    });
  });

  describe('CleanCommand', () => {
    test('should clean stopped containers', async () => {
      await CleanCommand.execute({});

      expect(logger.header).toHaveBeenCalledWith('Cleaning Stopped Containers');
      expect(docker.executeComposeCommand).toHaveBeenCalledWith('rm -f');
    });
  });

  describe('PortsCommand', () => {
    test('should display port mappings', async () => {
      await PortsCommand.execute({});

      expect(logger.header).toHaveBeenCalledWith('Port Mappings');
      expect(docker.getContainers).toHaveBeenCalled();
    });

    test('should handle no running services', async () => {
      docker.getContainers.mockResolvedValue([]);

      await PortsCommand.execute({});

      expect(logger.info).toHaveBeenCalledWith('No running services found.');
    });
  });

  describe('InspectCommand', () => {
    test('should return error if no service specified', async () => {
      await InspectCommand.execute(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a service to inspect');
    });

    test('should inspect service container', async () => {
      docker.docker = {
        getContainer: jest.fn().mockReturnValue({
          inspect: jest.fn().mockResolvedValue({ Config: { Env: [] } })
        })
      };

      await InspectCommand.execute('postgres', {});

      expect(logger.header).toHaveBeenCalledWith('Inspecting Container: postgres');
    });
  });
});