// ===== IMPORTS & DEPENDENCIES =====
const os = require('os');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const net = require('net');

const execAsync = promisify(exec);

// ===== CROSS-PLATFORM UTILITIES =====
class PlatformUtils {
  constructor() {
    this.platform = os.platform();
    this.isWindows = this.platform === 'win32';
    this.isMacOS = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
  }

  // ===== PORT MANAGEMENT =====
  async isPortFree(port) {
    return new Promise(resolve => {
      const server = net.createServer();

      server.listen(port, err => {
        if (err) {
          resolve(false);
        } else {
          server.once('close', () => resolve(true));
          server.close();
        }
      });

      server.on('error', () => resolve(false));
    });
  }

  async findFreePort(basePort, maxAttempts = 50) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = basePort + i;
      if (await this.isPortFree(port)) {
        return port;
      }
    }
    return basePort; // Fallback to original port
  }

  async getPortProcessInfo(port) {
    try {
      if (this.isWindows) {
        // Windows: Use netstat
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.trim().split('\n');
        if (lines.length > 0 && lines[0]) {
          const parts = lines[0].trim().split(/\s+/);
          const pid = parts[parts.length - 1];

          // Get process name from PID
          try {
            const { stdout: processName } = await execAsync(
              `tasklist /fi "PID eq ${pid}" /fo csv /nh`
            );
            const name = processName.split(',')[0].replace(/"/g, '');
            return `${name} (PID: ${pid})`;
          } catch {
            return `PID: ${pid}`;
          }
        }
      } else {
        // Unix-like: Try lsof first, fallback to netstat
        try {
          const { stdout } = await execAsync(`lsof -i :${port} -P -n`);
          const lines = stdout.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            return `${parts[0]} (PID: ${parts[1]})`;
          }
        } catch {
          // Fallback to netstat
          const { stdout } = await execAsync(`netstat -tulnp 2>/dev/null | grep :${port}`);
          const lines = stdout.trim().split('\n');
          if (lines.length > 0 && lines[0]) {
            const match = lines[0].match(/(\d+)\/(\w+)/);
            if (match) {
              return `${match[2]} (PID: ${match[1]})`;
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors, just return unknown
    }
    return 'Unknown process';
  }

  // ===== PACKAGE MANAGER DETECTION =====
  async detectPackageManager() {
    const managers = [];

    if (this.isWindows) {
      // Windows package managers
      try {
        await execAsync('choco --version');
        managers.push('chocolatey');
      } catch {
        // eslint-disable-line no-empty
      }

      try {
        await execAsync('winget --version');
        managers.push('winget');
      } catch {
        // eslint-disable-line no-empty
      }

      try {
        await execAsync('scoop --version');
        managers.push('scoop');
      } catch {
        // eslint-disable-line no-empty
      }
    } else if (this.isMacOS) {
      // macOS package managers
      try {
        await execAsync('brew --version');
        managers.push('homebrew');
      } catch {
        // eslint-disable-line no-empty
      }

      try {
        await execAsync('port version');
        managers.push('macports');
      } catch {
        // eslint-disable-line no-empty
      }
    } else {
      // Linux package managers
      try {
        await execAsync('apt --version');
        managers.push('apt');
      } catch {
        // eslint-disable-line no-empty
      }

      try {
        await execAsync('yum --version');
        managers.push('yum');
      } catch {
        // eslint-disable-line no-empty
      }

      try {
        await execAsync('dnf --version');
        managers.push('dnf');
      } catch {
        // eslint-disable-line no-empty
      }

      try {
        await execAsync('pacman --version');
        managers.push('pacman');
      } catch {
        // eslint-disable-line no-empty
      }

      try {
        await execAsync('zypper --version');
        managers.push('zypper');
      } catch {
        // eslint-disable-line no-empty
      }
    }

    return managers;
  }

  // ===== PATH UTILITIES =====
  getDockerComposePath() {
    // Return appropriate compose file path based on platform
    const basePath = process.cwd();

    if (this.isWindows) {
      return basePath.replace(/\\/g, '/'); // Normalize Windows paths for Docker
    }

    return basePath;
  }

  getVolumePathFormat(localPath) {
    if (this.isWindows) {
      // Convert Windows paths to Docker-compatible format
      return localPath
        .replace(/\\/g, '/')
        .replace(/^([A-Za-z]):/, (match, drive) => `/${drive.toLowerCase()}`);
    }

    return localPath;
  }

  // ===== PROCESS MANAGEMENT =====
  async getRunningProcesses(filterName = '') {
    try {
      if (this.isWindows) {
        const { stdout } = await execAsync('tasklist /fo csv');
        const lines = stdout.trim().split('\n').slice(1); // Skip header
        return lines
          .map(line => {
            const parts = line.split(',').map(part => part.replace(/"/g, ''));
            return {
              name: parts[0],
              pid: parts[1],
              memory: parts[4],
            };
          })
          .filter(
            proc => !filterName || proc.name.toLowerCase().includes(filterName.toLowerCase())
          );
      } else {
        const { stdout } = await execAsync('ps aux');
        const lines = stdout.trim().split('\n').slice(1); // Skip header
        return lines
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              name: parts[10],
              pid: parts[1],
              cpu: parts[2],
              memory: parts[3],
            };
          })
          .filter(
            proc => !filterName || proc.name.toLowerCase().includes(filterName.toLowerCase())
          );
      }
    } catch (error) {
      return [];
    }
  }

  // ===== SHELL COMMAND EXECUTION =====
  async executeShellCommand(command, options = {}) {
    const shell = this.isWindows ? 'cmd' : 'bash';
    const shellFlag = this.isWindows ? '/c' : '-c';

    return new Promise((resolve, reject) => {
      const child = spawn(shell, [shellFlag, command], {
        stdio: options.stdio || 'pipe',
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', data => {
          stdout += data.toString();
          if (options.onData) {
            options.onData(data.toString());
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', data => {
          stderr += data.toString();
          if (options.onError) {
            options.onError(data.toString());
          }
        });
      }

      child.on('close', code => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
        }
      });

      child.on('error', error => {
        reject(error);
      });
    });
  }

  // ===== SYSTEM INFO =====
  getSystemInfo() {
    return {
      platform: this.platform,
      arch: os.arch(),
      release: os.release(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      cpus: os.cpus().length,
      hostname: os.hostname(),
      homeDir: os.homedir(),
      tmpDir: os.tmpdir(),
    };
  }

  // ===== TERMINAL UTILITIES =====
  getTerminalSize() {
    return {
      columns: process.stdout.columns || 120,
      rows: process.stdout.rows || 40,
    };
  }

  // ===== PATH HELPERS =====
  joinPath(...paths) {
    const path = require('path');
    return path.join(...paths);
  }

  resolvePath(filePath) {
    const path = require('path');
    return path.resolve(filePath);
  }

  // ===== DOCKER DESKTOP DETECTION =====
  async isDockerDesktopRunning() {
    try {
      if (this.isWindows) {
        const { stdout } = await execAsync(
          'tasklist /fi "imagename eq Docker Desktop.exe" /fo csv /nh'
        );
        return stdout.trim().length > 0;
      } else if (this.isMacOS) {
        const { stdout } = await execAsync('pgrep -f "Docker Desktop"');
        return stdout.trim().length > 0;
      } else {
        // Linux - check for Docker daemon
        const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"');
        return stdout.trim().length > 0;
      }
    } catch {
      return false;
    }
  }
}

module.exports = new PlatformUtils();
