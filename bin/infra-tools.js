#!/usr/bin/env node

// ===== IMPORTS & DEPENDENCIES =====
const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

// Import command modules
const StatusCommand = require('../src/commands/status');
const StartCommand = require('../src/commands/start');
const StopCommand = require('../src/commands/stop');
const RestartCommand = require('../src/commands/restart');
const LogsCommand = require('../src/commands/logs');
const ExecCommand = require('../src/commands/exec');
const ShellCommand = require('../src/commands/shell');
const InspectCommand = require('../src/commands/inspect');
const PortsCommand = require('../src/commands/ports');
const VolumesCommand = require('../src/commands/volumes');
const BackupCommand = require('../src/commands/backup');
const PullCommand = require('../src/commands/pull');
const BuildCommand = require('../src/commands/build');
const CleanCommand = require('../src/commands/clean');
const ResetCommand = require('../src/commands/reset');
const ConfigCommand = require('../src/commands/config');
const VarsCommand = require('../src/commands/vars');

// Import utilities
const logger = require('../src/utils/logger');

// ===== CONFIGURATION & CONSTANTS =====
const program = new Command();
const pkg = require('../package.json');

// Service groups (matching original bash script)
const SERVICE_GROUPS = {
  databases: ['postgres', 'mysql', 'mongo', 'redis', 'mssql', 'neo4j', 'couchdb'],
  messaging: ['kafka', 'zookeeper', 'rabbitmq'],
  logging: ['elasticsearch', 'logstash', 'kibana'],
  monitoring: ['prometheus', 'grafana'],
  gateway: ['kong-database', 'kong', 'konga'],
  authentication: ['keycloak'],
};

const ALL_SERVICES = Object.values(SERVICE_GROUPS).flat();

// ===== CLI SETUP & CONFIGURATION =====
program
  .name('infra-tools')
  .description('🚀 Cross-platform Docker infrastructure management CLI')
  .version(pkg.version)
  .configureOutput({
    writeOut: str => process.stdout.write(str),
    writeErr: str => process.stderr.write(chalk.red(str)),
  });

// ===== CORE COMMANDS =====

// Status command
program
  .command('status')
  .description('Show service status and health information')
  .option('--json', 'Output in JSON format')
  .option('--active', 'Show only running services')
  .option('--legacy', 'Use legacy table format')
  .argument('[service]', 'Specific service to check')
  .action(async (service, options) => {
    try {
      await StatusCommand.execute(service, options);
    } catch (error) {
      logger.error(`Status command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Start command (default when no command specified)
program
  .command('start', { isDefault: false })
  .description('Start services (default: all services)')
  .option('--dynamic-ports', 'Enable dynamic port assignment')
  .option('--skip-port-check', 'Skip port conflict checking')
  .argument('[services...]', 'Services to start')
  .action(async (services, options) => {
    try {
      await StartCommand.execute(services, options);
    } catch (error) {
      logger.error(`Start command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Stop command
program
  .command('stop')
  .alias('down')
  .description('Stop services (default: all services)')
  .argument('[services...]', 'Services to stop')
  .action(async (services, options) => {
    try {
      await StopCommand.execute(services, options);
    } catch (error) {
      logger.error(`Stop command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Restart command
program
  .command('restart')
  .description('Restart services (default: all services)')
  .argument('[services...]', 'Services to restart')
  .action(async (services, options) => {
    try {
      await RestartCommand.execute(services, options);
    } catch (error) {
      logger.error(`Restart command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Logs command
program
  .command('logs')
  .description('Show logs for a service')
  .option('-f, --follow', 'Follow log output')
  .option('--tail <lines>', 'Number of lines to show from end of logs', '100')
  .argument('<service>', 'Service to show logs for')
  .action(async (service, options) => {
    try {
      await LogsCommand.execute(service, options);
    } catch (error) {
      logger.error(`Logs command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Exec command
program
  .command('exec')
  .description('Execute command in service container')
  .argument('<service>', 'Service to execute command in')
  .argument('[command...]', 'Command to execute (default: bash)')
  .action(async (service, command, options) => {
    try {
      await ExecCommand.execute(service, command, options);
    } catch (error) {
      logger.error(`Exec command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Shell command
program
  .command('shell')
  .description('Open interactive shell in service container')
  .argument('<service>', 'Service to open shell in')
  .action(async (service, options) => {
    try {
      await ShellCommand.execute(service, options);
    } catch (error) {
      logger.error(`Shell command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Inspect command
program
  .command('inspect')
  .description('Inspect container details')
  .argument('<service>', 'Service to inspect')
  .action(async (service, options) => {
    try {
      await InspectCommand.execute(service, options);
    } catch (error) {
      logger.error(`Inspect command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Ports command
program
  .command('ports')
  .description('Show port mappings for running services')
  .action(async options => {
    try {
      await PortsCommand.execute(options);
    } catch (error) {
      logger.error(`Ports command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Volumes command
program
  .command('volumes')
  .description('Show volume usage')
  .argument('[service]', 'Specific service to check volumes for')
  .action(async (service, options) => {
    try {
      await VolumesCommand.execute(service, options);
    } catch (error) {
      logger.error(`Volumes command failed: ${error.message}`);
      process.exit(1);
    }
  });

// List volumes command
program
  .command('list-volumes')
  .description('List volumes with detailed information')
  .argument('[service]', 'Specific service to list volumes for')
  .action(async (service, options) => {
    try {
      await VolumesCommand.list(service, options);
    } catch (error) {
      logger.error(`List volumes command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Inspect volume command
program
  .command('inspect-volume')
  .description('Inspect specific volume details')
  .argument('<volume>', 'Volume name to inspect')
  .action(async (volume, options) => {
    try {
      await VolumesCommand.inspect(volume, options);
    } catch (error) {
      logger.error(`Inspect volume command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Remove volume command
program
  .command('remove-volume')
  .description('Remove specific volume (with confirmation)')
  .argument('<volume>', 'Volume name to remove')
  .action(async (volume, options) => {
    try {
      await VolumesCommand.remove(volume, options);
    } catch (error) {
      logger.error(`Remove volume command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Backup command
program
  .command('backup')
  .description('Backup volumes')
  .argument('[volumes...]', 'Specific volumes to backup (default: all)')
  .action(async (volumes, options) => {
    try {
      await BackupCommand.execute(volumes, options);
    } catch (error) {
      logger.error(`Backup command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Pull command
program
  .command('pull')
  .description('Pull latest images')
  .argument('[services...]', 'Services to pull images for (default: all)')
  .action(async (services, options) => {
    try {
      await PullCommand.execute(services, options);
    } catch (error) {
      logger.error(`Pull command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Build command
program
  .command('build')
  .description('Build images')
  .option('--no-cache', 'Build without cache')
  .action(async options => {
    try {
      await BuildCommand.execute(options);
    } catch (error) {
      logger.error(`Build command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Clean command
program
  .command('clean')
  .description('Remove stopped containers')
  .action(async options => {
    try {
      await CleanCommand.execute(options);
    } catch (error) {
      logger.error(`Clean command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Reset command
program
  .command('reset')
  .description('Reset environment (removes all data!)')
  .action(async options => {
    try {
      await ResetCommand.execute(options);
    } catch (error) {
      logger.error(`Reset command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Configure service settings interactively')
  .argument('<service>', 'Service to configure')
  .action(async (service, options) => {
    try {
      await ConfigCommand.execute(service, options);
    } catch (error) {
      logger.error(`Config command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Vars command
program
  .command('vars')
  .description('Show environment variables for a service')
  .argument('<service>', 'Service to show environment variables for')
  .action(async (service, options) => {
    try {
      await VarsCommand.execute(service, options);
    } catch (error) {
      logger.error(`Vars command failed: ${error.message}`);
      process.exit(1);
    }
  });

// ===== SERVICE GROUP COMMANDS =====
Object.keys(SERVICE_GROUPS).forEach(groupName => {
  program
    .command(groupName)
    .description(`Start ${groupName} services: ${SERVICE_GROUPS[groupName].join(', ')}`)
    .option('--dynamic-ports', 'Enable dynamic port assignment')
    .option('--skip-port-check', 'Skip port conflict checking')
    .action(async options => {
      try {
        await StartCommand.execute(SERVICE_GROUPS[groupName], options);
      } catch (error) {
        logger.error(`${groupName} command failed: ${error.message}`);
        process.exit(1);
      }
    });
});

// ===== DEFAULT BEHAVIOR =====
// If no command is provided, default to starting all services
program.action(async () => {
  try {
    await StartCommand.execute([], {});
  } catch (error) {
    logger.error(`Default start command failed: ${error.message}`);
    process.exit(1);
  }
});

// ===== ERROR HANDLING =====
program.configureHelp({
  sortSubcommands: true,
  subcommandTerm: cmd => cmd.name() + ' ' + cmd.usage(),
});

// Custom help with service information
program.addHelpText(
  'after',
  `

AVAILABLE SERVICES:
  Databases:      ${SERVICE_GROUPS.databases.join(', ')}
  Messaging:      ${SERVICE_GROUPS.messaging.join(', ')}
  Logging:        ${SERVICE_GROUPS.logging.join(', ')}
  Monitoring:     ${SERVICE_GROUPS.monitoring.join(', ')}
  Gateway:        ${SERVICE_GROUPS.gateway.join(', ')}
  Authentication: ${SERVICE_GROUPS.authentication.join(', ')}

USAGE WITH NPX:
  npx infra-tools status
  npx infra-tools start postgres redis
  npx infra-tools config postgres
  npx infra-tools vars postgres
  npx infra-tools databases
  npx infra-tools logs kafka -f

ENVIRONMENT VARIABLES:
  SKIP_VALIDATION=true      Skip Docker Compose configuration validation
  SKIP_PORT_CHECK=true      Skip port conflict checking
  DYNAMIC_PORTS=true        Enable dynamic port assignment

For more information: https://github.com/aref-m/infra-tools
`
);

// ===== INITIALIZATION & STARTUP =====
async function main() {
  try {
    // Parse command line arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error(`CLI error: ${error.message}`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Start the CLI
if (require.main === module) {
  main();
}

module.exports = { program, SERVICE_GROUPS, ALL_SERVICES };
