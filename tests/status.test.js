// ===== IMPORTS & DEPENDENCIES =====
const StatusCommand = require('../src/commands/status');
const docker = require('../src/services/docker');
const logger = require('../src/utils/logger');
const { ConfigUtils } = require('../src/utils/config');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/config');
jest.mock('cli-table3');

// ===== STATUS COMMAND TESTS =====
describe('StatusCommand', () => {
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log to capture output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Setup docker mock defaults
    docker.checkDockerConnection = jest.fn().mockResolvedValue(true);
    docker.getServiceStatus = jest.fn();
    
    // Setup ConfigUtils mock
    ConfigUtils.isValidService = jest.fn();
    ConfigUtils.getAllServices = jest.fn().mockReturnValue(['postgres', 'redis']);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('execute', () => {
    test('should return early if Docker connection fails', async () => {
      docker.checkDockerConnection.mockResolvedValue(false);

      await StatusCommand.execute(null, {});

      expect(docker.checkDockerConnection).toHaveBeenCalled();
      expect(logger.header).not.toHaveBeenCalled();
    });

    test('should display dashboard header', async () => {
      docker.getServiceStatus.mockResolvedValue({
        service: 'postgres',
        status: 'running',
        health: 'healthy'
      });

      await StatusCommand.execute(null, {});

      expect(logger.header).toHaveBeenCalledWith('Infra-Tools Dashboard');
    });

    test('should show single service when specified', async () => {
      ConfigUtils.isValidService.mockReturnValue(true);
      docker.getServiceStatus.mockResolvedValue({
        service: 'postgres',
        status: 'running'
      });

      await StatusCommand.execute('postgres', {});

      expect(docker.getServiceStatus).toHaveBeenCalledWith('postgres');
    });

    test('should show error for invalid service', async () => {
      ConfigUtils.isValidService.mockReturnValue(false);

      await StatusCommand.execute('invalid-service', {});

      expect(logger.error).toHaveBeenCalledWith("Service 'invalid-service' not found");
    });
  });

  describe('JSON output', () => {
    test('should output JSON when json option is set', async () => {
      const mockStatus = { service: 'postgres', status: 'running' };
      
      ConfigUtils.isValidService.mockReturnValue(true);
      docker.getServiceStatus.mockResolvedValue(mockStatus);

      await StatusCommand.execute('postgres', { json: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockStatus, null, 2));
    });
  });

  describe('showAllServices', () => {
    test('should get status for all services', async () => {
      docker.getServiceStatus
        .mockResolvedValueOnce({ service: 'postgres', status: 'running' })
        .mockResolvedValueOnce({ service: 'redis', status: 'stopped' });

      const displaySpy = jest.spyOn(StatusCommand, 'displayServiceTable').mockImplementation();

      await StatusCommand.showAllServices({});

      expect(docker.getServiceStatus).toHaveBeenCalledTimes(2);
      expect(docker.getServiceStatus).toHaveBeenCalledWith('postgres');
      expect(docker.getServiceStatus).toHaveBeenCalledWith('redis');
      
      displaySpy.mockRestore();
    });

    test('should filter active services when active option is set', async () => {
      docker.getServiceStatus
        .mockResolvedValueOnce({ service: 'postgres', status: 'running' })
        .mockResolvedValueOnce({ service: 'redis', status: 'stopped' });

      const displaySpy = jest.spyOn(StatusCommand, 'displayServiceTable').mockImplementation();

      await StatusCommand.showAllServices({ active: true });

      // Should only display running services
      const displayedServices = displaySpy.mock.calls[0][0];
      expect(displayedServices).toHaveLength(1);
      expect(displayedServices[0].status).toBe('running');
      
      displaySpy.mockRestore();
    });
  });
});