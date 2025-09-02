// ===== IMPORTS & DEPENDENCIES =====
const path = require('path');
const os = require('os');
const fs = require('fs');

// ===== EXTERNAL CONFIG LOADING =====
let externalConfig = null;

function loadExternalConfig() {
  if (externalConfig) {
    return externalConfig;
  }

  const configPath = path.resolve(__dirname, '../..', 'config', 'services.json');

  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      externalConfig = JSON.parse(configData);
      return externalConfig;
    }
  } catch (error) {
    console.warn(`Failed to load external config: ${error.message}`);
  }

  return null;
}

// ===== CONFIGURATION & CONSTANTS =====
const CONFIG = {
  // Project settings
  PROJECT_NAME: 'infra',
  COMPOSE_FILE: 'docker-compose.yml',
  BACKUP_DIR: './backups',

  // Service definitions (matching original bash script)
  SERVICE_GROUPS: {
    databases: ['postgres', 'mysql', 'mongo', 'redis', 'mssql', 'neo4j', 'couchdb'],
    messaging: ['kafka', 'zookeeper', 'rabbitmq'],
    logging: ['elasticsearch', 'logstash', 'kibana'],
    monitoring: ['prometheus', 'grafana'],
    gateway: ['kong-database', 'kong', 'konga'],
    authentication: ['keycloak'],
  },

  // Service port mappings (matching dev-tools:57-77)
  SERVICE_PORTS: {
    postgres: ['5432'],
    mysql: ['3306'],
    mongo: ['27017'],
    redis: ['6379'],
    mssql: ['1433'],
    neo4j: ['7474'],
    couchdb: ['5984'],
    kafka: ['9092'],
    zookeeper: ['2181'],
    rabbitmq: ['5672', '15672'],
    elasticsearch: ['9200'],
    logstash: ['5044'],
    kibana: ['5601'],
    prometheus: ['9090'],
    grafana: ['3000'],
    'kong-database': ['5433'],
    kong: ['8000'],
    konga: ['1337'],
    keycloak: ['8080'],
  },

  // Service descriptions (matching dev-tools:80-103)
  SERVICE_DESCRIPTIONS: {
    postgres: ['PostgreSQL'],
    mysql: ['MySQL'],
    mongo: ['MongoDB'],
    redis: ['Redis'],
    mssql: ['SQL Server'],
    neo4j: ['Neo4j Browser'],
    couchdb: ['CouchDB'],
    kafka: ['Kafka'],
    zookeeper: ['Zookeeper'],
    rabbitmq: ['AMQP', 'Management'],
    elasticsearch: ['HTTP'],
    logstash: ['Beats'],
    kibana: ['Web UI'],
    prometheus: ['Web UI'],
    grafana: ['Web UI'],
    'kong-database': ['Kong PostgreSQL'],
    kong: ['Proxy HTTP'],
    konga: ['Kong Admin UI'],
    keycloak: ['Identity Provider'],
  },

  // Default service images
  SERVICE_IMAGES: {
    postgres: 'postgres:14-alpine',
    mysql: 'mysql:8.0.40',
    mongo: 'mongo:7.0.17',
    redis: 'redis:7.4-alpine',
    mssql: 'mcr.microsoft.com/mssql/server:2022-latest',
    neo4j: 'neo4j:5.27',
    couchdb: 'couchdb:3.4',
    kafka: 'confluentinc/cp-kafka:7.5.0',
    zookeeper: 'confluentinc/cp-zookeeper:7.5.0',
    rabbitmq: 'rabbitmq:3.12-management',
    elasticsearch: 'docker.elastic.co/elasticsearch/elasticsearch:8.11.0',
    logstash: 'docker.elastic.co/logstash/logstash:8.11.0',
    kibana: 'docker.elastic.co/kibana/kibana:8.11.0',
    prometheus: 'prom/prometheus:v2.48.0',
    grafana: 'grafana/grafana:10.2.0',
    'kong-database': 'postgres:14-alpine',
    kong: 'kong:3.4',
    konga: 'pantsel/konga:0.14.9',
    keycloak: 'quay.io/keycloak/keycloak:23.0',
  },

  // Docker network settings
  NETWORK: {
    name: 'infra-network',
    subnet: '172.20.0.0/16',
    driver: 'bridge',
  },

  // Compose file paths
  COMPOSE_FILES: [
    'compose/services/databases.yml',
    'compose/services/messaging.yml',
    'compose/services/logging.yml',
    'compose/services/monitoring.yml',
    'compose/services/gateway.yml',
    'compose/services/orchestration.yml',
  ],

  // Volume names
  VOLUMES: [
    'postgres-data',
    'mongo-data',
    'mysql-data',
    'redis-data',
    'mssql-data',
    'rabbitmq-data',
    'elasticsearch-data',
    'logstash-data',
    'kibana-data',
    'kafka-data',
    'zookeeper-data',
    'prometheus-data',
    'grafana-data',
    'neo4j-data',
    'neo4j-logs',
    'couchdb-data',
    'kong-db-data',
  ],

  // Platform-specific settings
  PLATFORM: {
    windows: {
      shell: 'cmd',
      shellFlag: '/c',
      packageManagers: ['chocolatey', 'winget', 'scoop'],
      portCommand: 'netstat -ano',
      processCommand: 'tasklist /fo csv',
    },
    unix: {
      shell: 'bash',
      shellFlag: '-c',
      packageManagers: ['apt', 'yum', 'dnf', 'brew', 'pacman', 'zypper'],
      portCommand: 'netstat -tulnp',
      processCommand: 'ps aux',
    },
  },

  // Environment variables
  ENV_VARS: {
    SKIP_VALIDATION: process.env.SKIP_VALIDATION === 'true',
    SKIP_PORT_CHECK: process.env.SKIP_PORT_CHECK === 'true',
    DYNAMIC_PORTS: process.env.DYNAMIC_PORTS === 'true',
    INFRA_NETWORK_SUBNET: process.env.INFRA_NETWORK_SUBNET || '172.20.0.0/16',
  },
};

// ===== UTILITY FUNCTIONS =====
const ConfigUtils = {
  // Get all services as flat array
  getAllServices() {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.services) {
      return Object.keys(extConfig.services);
    }
    return Object.values(CONFIG.SERVICE_GROUPS).flat();
  },

  // Get services for a group
  getServiceGroup(groupName) {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.services) {
      return Object.keys(extConfig.services).filter(
        service => extConfig.services[service].group === groupName
      );
    }
    return CONFIG.SERVICE_GROUPS[groupName] || [];
  },

  // Validate service names
  isValidService(serviceName) {
    return this.getAllServices().includes(serviceName);
  },

  // Get service port configuration
  getServicePorts(serviceName) {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.services && extConfig.services[serviceName]) {
      return extConfig.services[serviceName].ports || [];
    }
    return CONFIG.SERVICE_PORTS[serviceName] || [];
  },

  // Get service descriptions
  getServiceDescriptions(serviceName) {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.services && extConfig.services[serviceName]) {
      return [extConfig.services[serviceName].description];
    }
    return CONFIG.SERVICE_DESCRIPTIONS[serviceName] || [];
  },

  // Get service image
  getServiceImage(serviceName) {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.services && extConfig.services[serviceName]) {
      return extConfig.services[serviceName].image;
    }
    return CONFIG.SERVICE_IMAGES[serviceName] || null;
  },

  // Get service environment variables
  getServiceEnvironment(serviceName) {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.services && extConfig.services[serviceName]) {
      return extConfig.services[serviceName].environment || {};
    }
    return {};
  },

  // Get service volumes
  getServiceVolumes(serviceName) {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.services && extConfig.services[serviceName]) {
      return extConfig.services[serviceName].volumes || [];
    }
    return [];
  },

  // Get container name for service
  getContainerName(serviceName) {
    const extConfig = loadExternalConfig();
    const projectName = extConfig?.project?.name || CONFIG.PROJECT_NAME;
    return `${projectName}_${serviceName}`;
  },

  // Get volume name for service
  getVolumeName(serviceName, suffix = 'data') {
    const extConfig = loadExternalConfig();
    const projectName = extConfig?.project?.name || CONFIG.PROJECT_NAME;
    return `${projectName}_${serviceName}-${suffix}`;
  },

  // Get project configuration
  getProjectConfig() {
    const extConfig = loadExternalConfig();
    if (extConfig && extConfig.project) {
      return extConfig.project;
    }
    return {
      name: CONFIG.PROJECT_NAME,
      network: CONFIG.NETWORK,
    };
  },

  // Validate external configuration
  validateExternalConfig() {
    const extConfig = loadExternalConfig();
    if (!extConfig) {
      return { valid: true, errors: [] };
    }

    const errors = [];

    // Validate project config
    if (!extConfig.project || !extConfig.project.name) {
      errors.push('Missing project.name in config');
    }

    // Validate services
    if (!extConfig.services || typeof extConfig.services !== 'object') {
      errors.push('Missing or invalid services configuration');
    } else {
      for (const [serviceName, serviceConfig] of Object.entries(extConfig.services)) {
        if (!serviceConfig.image) {
          errors.push(`Missing image for service: ${serviceName}`);
        }
        if (!Array.isArray(serviceConfig.ports)) {
          errors.push(`Invalid ports for service: ${serviceName}`);
        }
        if (!serviceConfig.group) {
          errors.push(`Missing group for service: ${serviceName}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  // Get platform-specific configuration
  getPlatformConfig() {
    const platform = os.platform();
    return platform === 'win32' ? CONFIG.PLATFORM.windows : CONFIG.PLATFORM.unix;
  },

  // Find dev-tools directory
  findDevToolsDirectory() {
    // Try different possible locations
    const possiblePaths = [
      process.cwd(), // Current directory
      path.resolve(process.cwd(), '..'), // Parent directory
      path.resolve(process.cwd(), '../dev-tools'), // Sibling directory
      path.resolve(process.cwd(), '../../dev-tools'), // Common workspace layout
      '/home/aref/workspace/dev-tools', // Known location
    ];

    for (const basePath of possiblePaths) {
      const composeFile = path.join(basePath, 'docker-compose.yml');
      if (fs.existsSync(composeFile)) {
        return basePath;
      }
    }

    // If not found, default to current directory
    return process.cwd();
  },

  // Get compose file paths with absolute paths
  getComposeFilePaths() {
    const basePath = this.findDevToolsDirectory();
    return CONFIG.COMPOSE_FILES.map(file => path.resolve(basePath, file));
  },

  // Get backup directory path
  getBackupDir() {
    const basePath = this.findDevToolsDirectory();
    return path.resolve(basePath, CONFIG.BACKUP_DIR);
  },

  // Generate timestamp for backups
  getTimestamp() {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5); // Remove milliseconds and Z
  },
};

module.exports = { CONFIG, ConfigUtils };
