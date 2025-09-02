# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2025-09-02

### Added
- `vars` command - Display environment variables for running services
  - Shows all environment variables with their current values
  - Color-coded output for better readability (cyan keys, yellow values)
  - Sorted alphabetically for easy scanning
  - Displays total count of environment variables
  - Usage: `npx infra-tools vars <service>`

### Documentation
- Updated README.md to include `vars` command in Container Operations section
- Added `vars` command example to Quick Start guide

## [1.0.0] - 2024-08-31

### Added
- Initial release of infra-tools CLI
- Cross-platform Docker infrastructure management
- Service management commands:
  - `start` - Start services or service groups
  - `stop` - Stop running services
  - `restart` - Restart services
  - `status` - Show service status and health with colored circle icons (🟢🟡⚫)
  - `config` - Interactive service configuration (image, ports, volumes, environment)
  - `logs` - View service logs
  - `ports` - Display port mappings
  - `shell` - Open interactive shell in container
  - `exec` - Execute commands in containers
  - `inspect` - Inspect container details
- Volume management commands:
  - `volumes` - List and inspect volumes
  - `backup` - Create volume backups
  - `reset` - Reset environment (destructive)
  - `clean` - Clean up stopped containers
- Image management commands:
  - `pull` - Pull service images
  - `build` - Build custom images
- Service groups support:
  - `databases` - PostgreSQL, MySQL, MongoDB, Redis, MSSQL, Neo4j, CouchDB
  - `messaging` - Kafka, Zookeeper, RabbitMQ
  - `logging` - Elasticsearch, Logstash, Kibana
  - `monitoring` - Prometheus, Grafana
  - `gateway` - Kong API Gateway with admin interface
- Enterprise-grade services (15+ services total)
- Health check monitoring
- Port conflict detection
- Dynamic port allocation
- Cross-platform compatibility (Windows, macOS, Linux)

### Technical Features
- ESLint + Prettier code formatting
- Jest testing framework
- Husky pre-commit hooks
- Docker Compose orchestration
- Professional CLI interface with colors and spinners
- **Interactive service configuration** - `config` command for easy service customization
- **External JSON configuration** - Customize ports, images, volumes, credentials per service
- Configuration validation and fallback to defaults
- **Enhanced status display** - Improved table formatting with proper column widths
- **Custom volume support** - Full support for custom volume names and configurations

### Configuration
- `config/services.json` - Main configuration file for service customization
- `config/services.example.json` - Example configuration with common customizations
- Interactive `config` command with prompts showing current/default values
- Override any service's:
  - Docker image and version
  - Port mappings
  - Environment variables (users, passwords, databases)
  - Volume names
  - Service groups

### UI Improvements
- Colored circle status icons (🟢 healthy, 🟡 unhealthy/restarting, ⚫ stopped)
- Optimized column widths for better readability
- Default images displayed for all services (including inactive ones)
- Full volume names displayed in status table
- Improved table formatting and spacing