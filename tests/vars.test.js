// ===== IMPORTS & DEPENDENCIES =====
const VarsCommand = require('../src/commands/vars');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');
const { ConfigUtils } = require('../src/utils/config');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/config');

// ===== VARS COMMAND TESTS =====
describe('VarsCommand', () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log to capture output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.validateServices = jest.fn().mockResolvedValue(true);
    ConfigUtils.isValidService = jest.fn();
    ConfigUtils.getContainerName = jest.fn();
    
    // Mock docker container inspect
    docker.docker = {
      getContainer: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({
          Config: {
            Env: ['NODE_ENV=production', 'PORT=3000', 'DATABASE_URL=postgres://localhost']
          }
        })
      })
    };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('execute', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await VarsCommand.execute('postgres', {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(docker.validateServices).not.toHaveBeenCalled();
    });

    test('should return error if no service specified', async () => {
      await VarsCommand.execute(null, {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a service to show environment variables for');
    });

    test('should return early if service validation fails', async () => {
      docker.validateServices.mockResolvedValue(false);

      await VarsCommand.execute('invalid-service', {});

      expect(docker.validateServices).toHaveBeenCalledWith(['invalid-service']);
    });

    test('should display environment variables for valid service', async () => {
      ConfigUtils.isValidService.mockReturnValue(true);
      ConfigUtils.getContainerName.mockReturnValue('infra_postgres');

      await VarsCommand.execute('postgres', {});

      expect(logger.header).toHaveBeenCalledWith('Environment Variables: postgres');
      expect(docker.docker.getContainer).toHaveBeenCalledWith('infra_postgres');
    });

    test('should handle container not found error', async () => {
      ConfigUtils.isValidService.mockReturnValue(true);
      ConfigUtils.getContainerName.mockReturnValue('infra_postgres');
      docker.docker.getContainer.mockReturnValue({
        inspect: jest.fn().mockRejectedValue(new Error('Container not found'))
      });

      await VarsCommand.execute('postgres', {});

      expect(logger.error).toHaveBeenCalledWith("Container not found for service 'postgres'");
    });
  });
});