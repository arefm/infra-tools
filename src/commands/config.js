// ===== IMPORTS & DEPENDENCIES =====
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const { ConfigUtils } = require('../utils/config');
const logger = require('../utils/logger');

// ===== CONFIG COMMAND IMPLEMENTATION =====
class ConfigCommand {
  static async execute(serviceName) {
    if (!serviceName) {
      logger.error('Service name is required');
      logger.info(`Usage: infra-tools config <service_name>`);
      logger.info(`Available services: ${ConfigUtils.getAllServices().join(', ')}`);
      return;
    }

    if (!ConfigUtils.isValidService(serviceName)) {
      logger.error(`Service '${serviceName}' not found`);
      logger.info(`Available services: ${ConfigUtils.getAllServices().join(', ')}`);
      return;
    }

    logger.header(`Configure Service: ${serviceName}`);

    await this.configureService(serviceName);
  }

  static async configureService(serviceName) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      // Get current configuration
      const currentImage = ConfigUtils.getServiceImage(serviceName);
      const currentPorts = ConfigUtils.getServicePorts(serviceName);
      const currentEnvironment = ConfigUtils.getServiceEnvironment(serviceName);

      logger.info(`\nConfiguring ${serviceName}...`);

      // Configure image
      const image = await this.promptWithDefault(
        rl,
        'Docker image',
        currentImage || 'Not configured'
      );

      // Configure ports
      const portsInput = await this.promptWithDefault(
        rl,
        'Ports (comma-separated)',
        currentPorts.join(',') || 'Not configured'
      );
      const ports = portsInput
        .split(',')
        .map(p => p.trim())
        .filter(p => p);

      // Configure environment variables
      logger.info('\nCurrent environment variables:');
      const envEntries = Object.entries(currentEnvironment);
      if (envEntries.length === 0) {
        logger.info('  No environment variables configured');
      } else {
        envEntries.forEach(([key, value]) => {
          logger.info(`  ${key}=${value}`);
        });
      }

      const addEnvVars = await this.promptYesNo(rl, 'Add/modify environment variables?', false);

      let environment = { ...currentEnvironment };
      if (addEnvVars) {
        environment = await this.configureEnvironmentVariables(rl, environment);
      }

      // Configure volumes
      const volumesInput = await this.promptWithDefault(
        rl,
        'Volume names (comma-separated)',
        `${serviceName}-data`
      );
      const volumes = volumesInput
        .split(',')
        .map(v => v.trim())
        .filter(v => v);

      // Save configuration
      await this.saveServiceConfig(serviceName, {
        image,
        ports,
        environment,
        volumes,
        group: this.getServiceGroup(serviceName),
      });

      logger.success(`\n✅ Configuration saved for ${serviceName}`);
      logger.info('Configuration will be applied on next service start');
    } finally {
      rl.close();
    }
  }

  static async promptWithDefault(rl, question, defaultValue) {
    return new Promise(resolve => {
      rl.question(`${question} [${defaultValue}]: `, answer => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  static async promptYesNo(rl, question, defaultValue) {
    const defaultText = defaultValue ? 'Y/n' : 'y/N';
    return new Promise(resolve => {
      rl.question(`${question} [${defaultText}]: `, answer => {
        const normalized = answer.trim().toLowerCase();
        if (normalized === '') {
          resolve(defaultValue);
        } else {
          resolve(normalized === 'y' || normalized === 'yes');
        }
      });
    });
  }

  static async configureEnvironmentVariables(rl, currentEnv) {
    const environment = { ...currentEnv };

    logger.info('\nConfigure environment variables (press Enter with empty key to finish):');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = await this.promptWithDefault(rl, 'Environment variable name', '');
      if (!key) {
        break;
      }

      const currentValue = environment[key] || '';
      const value = await this.promptWithDefault(rl, `Value for ${key}`, currentValue);

      if (value) {
        environment[key] = value;
      } else if (environment[key]) {
        const remove = await this.promptYesNo(rl, `Remove ${key}?`, false);
        if (remove) {
          delete environment[key];
        }
      }
    }

    return environment;
  }

  static getServiceGroup(serviceName) {
    const serviceGroups = {
      postgres: 'databases',
      mysql: 'databases',
      mongo: 'databases',
      redis: 'databases',
      mssql: 'databases',
      neo4j: 'databases',
      couchdb: 'databases',
      kafka: 'messaging',
      zookeeper: 'messaging',
      rabbitmq: 'messaging',
      elasticsearch: 'logging',
      logstash: 'logging',
      kibana: 'logging',
      prometheus: 'monitoring',
      grafana: 'monitoring',
      'kong-database': 'gateway',
      kong: 'gateway',
      konga: 'gateway',
      keycloak: 'authentication',
    };
    return serviceGroups[serviceName] || 'other';
  }

  static async saveServiceConfig(serviceName, config) {
    const configDir = path.resolve(__dirname, '../..', 'config');
    const configFile = path.join(configDir, 'services.json');

    // Ensure config directory exists
    await fs.ensureDir(configDir);

    let serviceConfig = {
      project: { name: 'infra' },
      services: {},
    };

    // Load existing config if it exists
    if (await fs.pathExists(configFile)) {
      try {
        const configData = await fs.readFile(configFile, 'utf8');
        serviceConfig = JSON.parse(configData);
      } catch (error) {
        logger.warning(`Failed to load existing config: ${error.message}`);
      }
    }

    // Update service configuration
    serviceConfig.services[serviceName] = config;

    // Save updated configuration
    await fs.writeFile(configFile, JSON.stringify(serviceConfig, null, 2));
    logger.info(`Configuration saved to: ${configFile}`);
  }
}

module.exports = ConfigCommand;
