// ===== IMPORTS & DEPENDENCIES =====
const ExecCommand = require('../src/commands/exec');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');

// ===== EXEC COMMAND TESTS =====
describe('ExecCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.validateServices = jest.fn().mockResolvedValue(true);
    docker.getServiceStatus = jest.fn().mockResolvedValue({ status: 'running' });
    docker.executeComposeCommand = jest.fn().mockResolvedValue();
  });

  describe('execute', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await ExecCommand.execute('postgres', [], {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(docker.validateServices).not.toHaveBeenCalled();
    });

    test('should return error if no service specified', async () => {
      await ExecCommand.execute(null, [], {});

      expect(logger.error).toHaveBeenCalledWith('Please specify a service for exec');
    });

    test('should return early if service validation fails', async () => {
      docker.validateServices.mockResolvedValue(false);

      await ExecCommand.execute('invalid-service', [], {});

      expect(docker.validateServices).toHaveBeenCalledWith(['invalid-service']);
      expect(docker.getServiceStatus).not.toHaveBeenCalled();
    });

    test('should return error if service is not running', async () => {
      docker.getServiceStatus.mockResolvedValue({ status: 'stopped' });

      await ExecCommand.execute('postgres', [], {});

      expect(logger.error).toHaveBeenCalledWith("Service 'postgres' is not running (status: stopped)");
    });

    test('should execute command in running service', async () => {
      await ExecCommand.execute('postgres', ['psql', '-U', 'postgres'], {});

      expect(docker.executeComposeCommand).toHaveBeenCalledWith(
        'exec postgres psql -U postgres', 
        [], 
        { stdio: 'inherit' }
      );
    });

    test('should use bash as default command when no command provided', async () => {
      await ExecCommand.execute('postgres', [], {});

      expect(docker.executeComposeCommand).toHaveBeenCalledWith(
        'exec postgres bash', 
        [], 
        { stdio: 'inherit' }
      );
    });
  });
});