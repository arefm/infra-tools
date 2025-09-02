# 🚀 Infra-Tools CLI (Cross-Platform)

**Cross-platform Node.js CLI for managing Docker infrastructure with 15+ enterprise services**

[![NPM Version](https://img.shields.io/npm/v/infra-tools.svg)](https://www.npmjs.com/package/infra-tools)
[![Platform Support](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](#platform-support)
[![Docker](https://img.shields.io/badge/docker-required-blue.svg)](https://docker.com)

## ✨ Features

- **🌍 Cross-Platform**: Windows, macOS, and Linux support
- **📦 NPX Ready**: Use instantly with `npx infra-tools`
- **🐳 Docker Integration**: Native Docker API integration with dockerode
- **🔌 15+ Services**: PostgreSQL, MySQL, MongoDB, Redis, Kafka, ELK, and more
- **⚡ Dynamic Ports**: Automatic port conflict resolution
- **📊 Rich UI**: Beautiful tables and status indicators
- **🔧 Zero Config**: Works out of the box with existing Docker Compose files

## 🚀 Quick Start

### Using NPX (Recommended)
```bash
# Start all services
npx infra-tools

# Check status
npx infra-tools status

# Start specific services  
npx infra-tools start postgres redis

# View logs
npx infra-tools logs kafka -f

# Show environment variables
npx infra-tools vars postgres
```

### Global Installation
```bash
npm install -g infra-tools
infra-tools status
infra-tools start databases
```

## 🖥️ Platform Support

### Windows
- **Requirements**: Docker Desktop with WSL2 or Hyper-V
- **Package Managers**: Chocolatey, Winget, Scoop support
- **Shells**: CMD, PowerShell, Windows Terminal support

### macOS  
- **Requirements**: Docker Desktop
- **Package Managers**: Homebrew, MacPorts support
- **Shells**: Bash, Zsh support

### Linux
- **Requirements**: Docker Engine or Docker Desktop
- **Package Managers**: apt, yum, dnf, pacman, zypper support  
- **Shells**: Bash, sh support

## 📋 Available Services

### Databases
- **PostgreSQL 15** - `postgres` (port 5432)
- **MySQL 8.0** - `mysql` (port 3306)  
- **MongoDB 7.0** - `mongo` (port 27017)
- **Redis 7** - `redis` (port 6379)
- **SQL Server 2022** - `mssql` (port 1433)
- **Neo4j 5.13** - `neo4j` (port 7474)
- **CouchDB 3.3** - `couchdb` (port 5984)

### Message Queues
- **Apache Kafka** - `kafka` (port 9092)
- **Zookeeper** - `zookeeper` (port 2181)
- **RabbitMQ** - `rabbitmq` (ports 5672, 15672)

### Logging & Search  
- **Elasticsearch** - `elasticsearch` (port 9200)
- **Logstash** - `logstash` (port 5044)
- **Kibana** - `kibana` (port 5601)

### Monitoring
- **Prometheus** - `prometheus` (port 9090)
- **Grafana** - `grafana` (port 3000)

### API Gateway
- **Kong Gateway** - `kong` (port 8000)
- **Kong Admin** - `kong-database` (port 5433)  
- **Konga UI** - `konga` (port 1337)

## 🛠️ Commands

### Service Management
```bash
npx infra-tools start [services...]     # Start services
npx infra-tools stop [services...]      # Stop services  
npx infra-tools restart [services...]   # Restart services
npx infra-tools status [--json|--active] # Show status
npx infra-tools config <service>        # Configure service interactively
```

### Service Groups
```bash
npx infra-tools databases    # All databases
npx infra-tools messaging    # Kafka + RabbitMQ
npx infra-tools logging      # ELK stack
npx infra-tools monitoring   # Prometheus + Grafana
npx infra-tools gateway      # Kong API Gateway
```

### Container Operations
```bash
npx infra-tools logs <service> [-f]     # View logs
npx infra-tools exec <service> [cmd]    # Execute command
npx infra-tools shell <service>         # Open shell
npx infra-tools inspect <service>       # Inspect container
npx infra-tools vars <service>          # Show environment variables
```

### Data Management
```bash
npx infra-tools volumes [service]       # Show volumes
npx infra-tools backup [volumes...]     # Backup data
npx infra-tools clean                   # Remove stopped containers
npx infra-tools reset                   # Reset environment
```

## ⚙️ Advanced Features

### Interactive Service Configuration
```bash
# Configure service image, ports, volumes, and environment variables
npx infra-tools config postgres
# Prompts for:
# - Docker image (default: postgres:14-alpine)
# - Ports (default: 5432)
# - Volume names (default: postgres-data)
# - Environment variables
```

### Dynamic Port Assignment
```bash
# Automatically find free ports if defaults are busy
npx infra-tools start --dynamic-ports postgres mysql
```

### Environment Variables
```bash
SKIP_PORT_CHECK=true npx infra-tools start
DYNAMIC_PORTS=true npx infra-tools start
```

### JSON Output
```bash
# Get machine-readable status
npx infra-tools status --json --active
```

## 🔧 Windows-Specific Features

- **Package Manager Integration**: Automatic Miller installation via Chocolatey/Winget/Scoop
- **Windows Terminal Support**: Enhanced experience with Windows Terminal
- **WSL2 Compatibility**: Seamless integration with Docker Desktop on WSL2
- **Path Normalization**: Automatic Windows path conversion for Docker volumes

## 🏗️ Architecture

The CLI is built with:
- **Commander.js**: Command-line interface framework
- **Dockerode**: Native Docker API integration  
- **Chalk**: Cross-platform terminal colors
- **CLI-Table3**: Beautiful ASCII tables
- **Inquirer**: Interactive prompts
- **Ora**: Elegant loading spinners

## 🤝 Migration from Bash Version

The Node.js CLI maintains 100% compatibility with the existing Bash version:
- Same command structure and arguments
- Same Docker Compose files (no changes needed)
- Same service names and port mappings
- Same volume and backup strategies

## 🌟 Acknowledgments

- **Docker** for containerization platform
- **All service maintainers** for excellent container images
- **Community** for feedback and contributions
- **Kong, Keycloak, Elastic, Confluent** for enterprise-grade services

## 📞 Support

- 📖 **Documentation**: Check this README and `infra-tools help`
- 📋 **Changelog**: See [CHANGELOG.md](CHANGELOG.md) for version history
- 🐛 **Issues**: [GitHub Issues](https://github.com/arefm/infra-tools/issues)
- 🚀 **Latest Features**: Check release notes for new functionality
- ☕ **Buy me a coffee**: https://www.buymeacoffee.com/arefdotuk

---

**Made with ❤️ for developers who want powerful, enterprise-grade tools without the complexity.**

*Start building amazing applications with complete development infrastructure in seconds!*

---

**Infra-Tools v1.0.0** - Created by 👨‍💻 [Aref M](https://aref.uk) | Licensed under MIT