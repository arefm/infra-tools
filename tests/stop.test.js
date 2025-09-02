// ===== IMPORTS & DEPENDENCIES =====
const StopCommand = require('../src/commands/stop');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');
const { ConfigUtils } = require('../src/utils/config');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/config');
jest.mock('ora');

// ===== STOP COMMAND TESTS =====
describe('StopCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.validateServices = jest.fn().mockResolvedValue(true);
    docker.executeComposeCommand = jest.fn().mockResolvedValue();
    
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

      await StopCommand.execute([], {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should stop specific services when provided', async () => {
      const services = ['postgres', 'redis'];

      await StopCommand.execute(services, {});

      expect(logger.header).toHaveBeenCalledWith('Stopping Services');
      expect(docker.validateServices).toHaveBeenCalledWith(services);
      expect(docker.executeComposeCommand).toHaveBeenCalledWith('stop', services);
    });

    test('should stop all services when no services specified', async () => {
      await StopCommand.execute([], {});

      expect(ConfigUtils.getAllServices).toHaveBeenCalled();
      expect(docker.validateServices).toHaveBeenCalledWith(['postgres', 'redis']);
      expect(docker.executeComposeCommand).toHaveBeenCalledWith('down');
    });

    test('should return early if service validation fails', async () => {
      docker.validateServices.mockResolvedValue(false);

      await StopCommand.execute(['invalid-service'], {});

      expect(docker.executeComposeCommand).not.toHaveBeenCalled();
    });
  });
});