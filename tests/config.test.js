// ===== IMPORTS & DEPENDENCIES =====
const { CONFIG, ConfigUtils } = require('../src/utils/config');

// ===== CONFIGURATION UTILS TESTS =====
describe('ConfigUtils', () => {
  describe('getAllServices', () => {
    test('should return all services from all groups', () => {
      const services = ConfigUtils.getAllServices();
      
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
      expect(services).toContain('postgres');
      expect(services).toContain('kafka');
    });
  });

  describe('getServiceGroup', () => {
    test('should return correct services for databases group', () => {
      const databases = ConfigUtils.getServiceGroup('databases');
      
      expect(Array.isArray(databases)).toBe(true);
      expect(databases).toContain('postgres');
      expect(databases).toContain('mysql');
    });

    test('should return empty array for invalid group', () => {
      const invalid = ConfigUtils.getServiceGroup('invalid-group');
      
      expect(Array.isArray(invalid)).toBe(true);
      expect(invalid.length).toBe(0);
    });
  });

  describe('isValidService', () => {
    test('should return true for valid services', () => {
      expect(ConfigUtils.isValidService('postgres')).toBe(true);
      expect(ConfigUtils.isValidService('kafka')).toBe(true);
      expect(ConfigUtils.isValidService('redis')).toBe(true);
    });

    test('should return false for invalid services', () => {
      expect(ConfigUtils.isValidService('invalid-service')).toBe(false);
      expect(ConfigUtils.isValidService('')).toBe(false);
      expect(ConfigUtils.isValidService(null)).toBe(false);
    });
  });

  describe('getServicePorts', () => {
    test('should return correct ports for known services', () => {
      const postgresPorts = ConfigUtils.getServicePorts('postgres');
      expect(postgresPorts).toEqual(['5432']);

      const rabbitmqPorts = ConfigUtils.getServicePorts('rabbitmq');
      expect(rabbitmqPorts).toEqual(['5672', '15672']);
    });

    test('should return empty array for unknown services', () => {
      const unknownPorts = ConfigUtils.getServicePorts('unknown');
      expect(unknownPorts).toEqual([]);
    });
  });

  describe('getServiceDescriptions', () => {
    test('should return descriptions for known services', () => {
      const postgresDesc = ConfigUtils.getServiceDescriptions('postgres');
      expect(Array.isArray(postgresDesc)).toBe(true);
      expect(postgresDesc.length).toBeGreaterThan(0);
    });

    test('should return empty array for unknown services', () => {
      const unknownDesc = ConfigUtils.getServiceDescriptions('unknown');
      expect(unknownDesc).toEqual([]);
    });
  });

  describe('getContainerName', () => {
    test('should return correct container name format', () => {
      const containerName = ConfigUtils.getContainerName('postgres');
      expect(containerName).toBe('infra_postgres');
    });
  });

  describe('getVolumeName', () => {
    test('should return correct volume name format', () => {
      const volumeName = ConfigUtils.getVolumeName('postgres');
      expect(volumeName).toBe('infra_postgres-data');
    });

    test('should use custom suffix when provided', () => {
      const volumeName = ConfigUtils.getVolumeName('postgres', 'logs');
      expect(volumeName).toBe('infra_postgres-logs');
    });
  });
});

describe('CONFIG', () => {
  test('should have required service groups', () => {
    expect(CONFIG.SERVICE_GROUPS).toBeDefined();
    expect(CONFIG.SERVICE_GROUPS.databases).toBeDefined();
    expect(CONFIG.SERVICE_GROUPS.messaging).toBeDefined();
    expect(CONFIG.SERVICE_GROUPS.logging).toBeDefined();
  });

  test('should have service ports defined', () => {
    expect(CONFIG.SERVICE_PORTS).toBeDefined();
    expect(CONFIG.SERVICE_PORTS.postgres).toEqual(['5432']);
    expect(CONFIG.SERVICE_PORTS.mysql).toEqual(['3306']);
  });
});