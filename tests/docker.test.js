// ===== IMPORTS & DEPENDENCIES =====
const { ConfigUtils } = require('../src/utils/config');

// Mock dockerode to avoid actual Docker calls in tests
jest.mock('dockerode');
jest.mock('../src/utils/logger');

const docker = require('../src/services/docker');

// ===== DOCKER SERVICE TESTS =====
describe('DockerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDockerConnection', () => {
    test('should return true when Docker is available', async () => {
      docker.docker.ping = jest.fn().mockResolvedValue({});
      
      const result = await docker.checkDockerConnection();
      expect(result).toBe(true);
      expect(docker.docker.ping).toHaveBeenCalled();
    });

    test('should return false when Docker is not available', async () => {
      docker.docker.ping = jest.fn().mockRejectedValue(new Error('Docker not running'));
      
      const result = await docker.checkDockerConnection();
      expect(result).toBe(false);
    });
  });

  describe('validateServices', () => {
    test('should return true for valid services', async () => {
      const validServices = ['postgres', 'redis', 'kafka'];
      
      const result = await docker.validateServices(validServices);
      expect(result).toBe(true);
    });

    test('should return false for invalid services', async () => {
      const invalidServices = ['postgres', 'invalid-service'];
      
      const result = await docker.validateServices(invalidServices);
      expect(result).toBe(false);
    });

    test('should return true for empty service list', async () => {
      const result = await docker.validateServices([]);
      expect(result).toBe(true);
    });
  });

  describe('getStatusIcon', () => {
    test('should return correct icons for different states', () => {
      expect(docker.getStatusIcon('running', 'healthy')).toBe('🟢');
      expect(docker.getStatusIcon('running', 'unhealthy')).toBe('🟡');
      expect(docker.getStatusIcon('running', 'unknown')).toBe('🟢');
      expect(docker.getStatusIcon('restarting', 'unknown')).toBe('🟡');
      expect(docker.getStatusIcon('stopped', 'unknown')).toBe('⚫');
    });
  });

  describe('formatUptime', () => {
    test('should format uptime correctly', () => {
      expect(docker.formatUptime('About 5 minutes')).toBe('~5 minutes');
      expect(docker.formatUptime('2 hours')).toBe('2 hours');
      expect(docker.formatUptime(null)).toBe('-');
      expect(docker.formatUptime('')).toBe('-');
    });
  });

  describe('formatPorts', () => {
    test('should format ports correctly', () => {
      const ports = [
        { publicPort: 5432, privatePort: 5432, type: 'tcp' },
        { publicPort: 3306, privatePort: 3306, type: 'tcp' }
      ];
      
      expect(docker.formatPorts(ports)).toBe('5432, 3306');
    });

    test('should handle empty ports', () => {
      expect(docker.formatPorts([])).toBe('-');
      expect(docker.formatPorts(null)).toBe('-');
    });

    test('should limit to first 2 ports', () => {
      const ports = [
        { publicPort: 5432, privatePort: 5432, type: 'tcp' },
        { publicPort: 3306, privatePort: 3306, type: 'tcp' },
        { publicPort: 6379, privatePort: 6379, type: 'tcp' }
      ];
      
      expect(docker.formatPorts(ports)).toBe('5432, 3306');
    });
  });

  describe('formatVolumes', () => {
    test('should format volumes correctly', () => {
      const volumes = ['infra_postgres-data', 'infra_mysql-data'];
      
      expect(docker.formatVolumes(volumes)).toBe('infra_postgres-data,infra_mysql-data');
    });

    test('should format volumes with version numbers correctly', () => {
      const volumes = ['infra_postgres17-data', 'infra_mysql8-data'];
      
      expect(docker.formatVolumes(volumes)).toBe('infra_postgres17-data,infra_mysql8-data');
    });

    test('should handle empty volumes', () => {
      expect(docker.formatVolumes([])).toBe('-');
      expect(docker.formatVolumes(null)).toBe('-');
    });

    test('should truncate long volume lists', () => {
      const volumes = ['infra_verylongservicename-data', 'infra_anotherlongname-data'];
      const result = docker.formatVolumes(volumes);
      
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('getContainers', () => {
    test('should filter project containers correctly', async () => {
      const mockContainers = [
        {
          Id: '123',
          Names: ['/infra_postgres-1'],
          Image: 'postgres:15',
          Status: 'Up 5 minutes',
          State: 'running',
          Ports: [],
          Created: 1234567890,
          Labels: {}
        },
        {
          Id: '456', 
          Names: ['/other_service_1'],
          Image: 'nginx:latest',
          Status: 'Up 1 hour',
          State: 'running',
          Ports: [],
          Created: 1234567890,
          Labels: {}
        }
      ];

      docker.docker.listContainers = jest.fn().mockResolvedValue(mockContainers);
      
      const containers = await docker.getContainers();
      
      expect(containers).toHaveLength(1);
      expect(containers[0].name).toBe('infra_postgres-1');
      expect(containers[0].serviceName).toBe('postgres');
    });
  });
});