// ===== IMPORTS & DEPENDENCIES =====
const { DevToolsCLI } = require('../src/index');
const docker = require('../src/services/docker');
const platform = require('../src/utils/platform');

// Mock dependencies
jest.mock('../src/services/docker');
jest.mock('../src/utils/platform');
jest.mock('../src/platform/windows');

// ===== CLI INITIALIZATION TESTS =====
describe('DevToolsCLI', () => {
  let cli;

  beforeEach(() => {
    cli = new DevToolsCLI();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with correct dependencies', () => {
      expect(cli.docker).toBeDefined();
      expect(cli.platform).toBeDefined();
      expect(cli.config).toBeDefined();
      expect(cli.utils).toBeDefined();
    });
  });

  describe('initialize', () => {
    test('should initialize successfully on non-Windows platform', async () => {
      platform.isWindows = false;
      docker.checkDockerConnection = jest.fn().mockResolvedValue(true);

      const result = await cli.initialize();
      
      expect(result).toBe(true);
      expect(docker.checkDockerConnection).toHaveBeenCalled();
    });

    test('should exit if Docker is not available', async () => {
      platform.isWindows = false;
      docker.checkDockerConnection = jest.fn().mockResolvedValue(false);
      
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

      await cli.initialize();
      
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe('service management', () => {
    test('should return all services', () => {
      const services = cli.getAllServices();
      
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
    });

    test('should return service groups', () => {
      const groups = cli.getServiceGroups();
      
      expect(groups).toHaveProperty('databases');
      expect(groups).toHaveProperty('messaging');
      expect(groups).toHaveProperty('logging');
    });

    test('should validate services correctly', () => {
      expect(cli.validateService('postgres')).toBe(true);
      expect(cli.validateService('invalid-service')).toBe(false);
    });
  });

  describe('checkDockerStatus', () => {
    test('should return Docker status when available', async () => {
      const mockDockerInfo = {
        ServerVersion: '24.0.0',
        Containers: 5,
        Images: 10,
        Volumes: 8
      };

      docker.docker = {
        info: jest.fn().mockResolvedValue(mockDockerInfo)
      };

      const status = await cli.checkDockerStatus();
      
      expect(status.available).toBe(true);
      expect(status.version).toBe('24.0.0');
      expect(status.containers).toBe(5);
    });

    test('should handle Docker connection errors', async () => {
      docker.docker = {
        info: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };

      const status = await cli.checkDockerStatus();
      
      expect(status.available).toBe(false);
      expect(status.error).toBe('Connection failed');
    });
  });

  describe('getServicesOverview', () => {
    test('should return services overview', async () => {
      docker.getServiceStatus = jest.fn()
        .mockResolvedValueOnce({ status: 'running' })
        .mockResolvedValueOnce({ status: 'stopped' })
        .mockResolvedValueOnce({ status: 'running' });

      // Mock a small subset of services for testing
      jest.spyOn(cli.utils, 'getAllServices').mockReturnValue(['postgres', 'redis', 'mysql']);

      const overview = await cli.getServicesOverview();
      
      expect(overview.total).toBe(3);
      expect(overview.running).toBe(2);
      expect(overview.stopped).toBe(1);
      expect(overview.groups).toBeDefined();
    });
  });

  describe('getSystemInfo', () => {
    test('should return complete system information', async () => {
      platform.getSystemInfo = jest.fn().mockReturnValue({
        platform: 'linux',
        arch: 'x64'
      });

      jest.spyOn(cli, 'checkDockerStatus').mockResolvedValue({
        available: true,
        version: '24.0.0'
      });

      jest.spyOn(cli, 'getServicesOverview').mockResolvedValue({
        total: 20,
        running: 5,
        stopped: 15
      });

      const systemInfo = await cli.getSystemInfo();
      
      expect(systemInfo).toHaveProperty('platform');
      expect(systemInfo).toHaveProperty('docker');
      expect(systemInfo).toHaveProperty('services');
      expect(systemInfo.docker.available).toBe(true);
    });
  });
});