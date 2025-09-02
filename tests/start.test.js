// ===== IMPORTS & DEPENDENCIES =====
const StartCommand = require('../src/commands/start');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');
const { ConfigUtils } = require('../src/utils/config');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/config');
jest.mock('ora');
jest.mock('inquirer');

// ===== START COMMAND TESTS =====
describe('StartCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup docker mock defaults
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.validateServices = jest.fn().mockResolvedValue(true);
    docker.validateComposeFiles = jest.fn().mockResolvedValue(true);
    docker.executeComposeCommand = jest.fn().mockResolvedValue();
    docker.checkPortConflicts = jest.fn().mockResolvedValue({ conflicts: [], hasConflicts: false });
    
    // Setup ConfigUtils mock
    ConfigUtils.getAllServices = jest.fn().mockReturnValue(['postgres', 'redis']);
    
    // Mock ora spinner
    const mockSpinner = {
      start: jest.fn().mockReturnThis(),
      succeed: jest.fn(),
      fail: jest.fn()
    };
    require('ora').mockReturnValue(mockSpinner);
  });

  describe('execute', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await StartCommand.execute([], {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should start services with static ports by default', async () => {
      const services = ['postgres'];

      await StartCommand.execute(services, {});

      expect(logger.header).toHaveBeenCalledWith('Starting Services');
      expect(docker.validateServices).toHaveBeenCalledWith(services);
      expect(docker.executeComposeCommand).toHaveBeenCalledWith('up -d', services);
    });

    test('should use all services when none specified', async () => {
      await StartCommand.execute([], {});

      expect(ConfigUtils.getAllServices).toHaveBeenCalled();
      expect(docker.validateServices).toHaveBeenCalledWith(['postgres', 'redis']);
    });

    test('should use dynamic ports when option is enabled', async () => {
      const services = ['postgres'];
      jest.spyOn(StartCommand, 'showDynamicPortAssignments').mockResolvedValue();
      jest.spyOn(StartCommand, 'showRunningServicePorts').mockResolvedValue();

      await StartCommand.execute(services, { dynamicPorts: true });

      expect(logger.info).toHaveBeenCalledWith('Dynamic port assignment enabled');
    });
  });

  describe('port conflicts', () => {
    test('should check for port conflicts', async () => {
      await StartCommand.startWithStaticPorts(['postgres'], {});

      expect(docker.checkPortConflicts).toHaveBeenCalledWith(['postgres']);
    });

    test('should not start services when user declines to continue with conflicts', async () => {
      docker.checkPortConflicts.mockResolvedValue({ 
        conflicts: [{ service: 'postgres', port: 5432 }], 
        hasConflicts: true 
      });
      
      const inquirer = require('inquirer');
      inquirer.prompt = jest.fn().mockResolvedValue({ continueAnyway: false });

      await StartCommand.startWithStaticPorts(['postgres'], {});

      expect(docker.executeComposeCommand).not.toHaveBeenCalled();
    });
  });
});