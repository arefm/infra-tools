// ===== IMPORTS & DEPENDENCIES =====
const LogsCommand = require('../src/commands/logs');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');

// ===== LOGS COMMAND TESTS =====
describe('LogsCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.validateServices = jest.fn().mockResolvedValue(true);
    docker.executeComposeCommand = jest.fn().mockResolvedValue();
    docker.getServiceStatus = jest.fn().mockResolvedValue({ status: 'running' });
  });

  describe('execute', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await LogsCommand.execute('postgres', {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(docker.validateServices).not.toHaveBeenCalled();
    });

    test('should return error if no service specified', async () => {
      await LogsCommand.execute(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a service for logs');
    });

    test('should return early if service validation fails', async () => {
      docker.validateServices.mockResolvedValue(false);

      await LogsCommand.execute('invalid-service', {});

      expect(docker.validateServices).toHaveBeenCalledWith(['invalid-service']);
      expect(docker.executeComposeCommand).not.toHaveBeenCalled();
    });

    test('should show logs with default tail when no options provided', async () => {
      await LogsCommand.execute('postgres', {});

      expect(docker.executeComposeCommand).toHaveBeenCalledWith(
        'logs --tail=undefined', 
        ['postgres'], 
        { stdio: 'inherit' }
      );
    });

    test('should follow logs when follow option is set', async () => {
      await LogsCommand.execute('postgres', { follow: true });

      expect(docker.executeComposeCommand).toHaveBeenCalledWith(
        'logs -f --tail=undefined', 
        ['postgres'], 
        { stdio: 'inherit' }
      );
    });

    test('should use custom tail value when provided', async () => {
      await LogsCommand.execute('postgres', { tail: '50' });

      expect(docker.executeComposeCommand).toHaveBeenCalledWith(
        'logs --tail=50', 
        ['postgres'], 
        { stdio: 'inherit' }
      );
    });
  });
});