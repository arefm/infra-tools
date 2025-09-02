// ===== IMPORTS & DEPENDENCIES =====
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execAsync = promisify(exec);

// ===== WINDOWS-SPECIFIC UTILITIES =====
class WindowsUtils {
  // ===== PACKAGE MANAGER OPERATIONS =====
  static async installMiller() {
    logger.info('Installing Miller on Windows...');

    const packageManagers = await this.detectPackageManagers();

    if (packageManagers.includes('chocolatey')) {
      return await this.installWithChocolatey();
    } else if (packageManagers.includes('winget')) {
      return await this.installWithWinget();
    } else if (packageManagers.includes('scoop')) {
      return await this.installWithScoop();
    } else {
      logger.error('No supported package manager found');
      logger.info('Please install one of the following package managers:');
      logger.plain('  • Chocolatey: https://chocolatey.org/install');
      logger.plain('  • Winget: Built into Windows 10+ (update Windows)');
      logger.plain('  • Scoop: https://scoop.sh');
      return false;
    }
  }

  static async detectPackageManagers() {
    const managers = [];

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

    return managers;
  }

  static async installWithChocolatey() {
    try {
      logger.info('Installing Miller via Chocolatey...');
      await execAsync('choco install miller -y');
      logger.success('Miller installed successfully via Chocolatey');
      return true;
    } catch (error) {
      logger.error(`Chocolatey installation failed: ${error.message}`);
      return false;
    }
  }

  static async installWithWinget() {
    try {
      logger.info('Installing Miller via Winget...');
      // Note: Miller may not be available in winget, this is a placeholder
      await execAsync('winget install miller');
      logger.success('Miller installed successfully via Winget');
      return true;
    } catch (error) {
      logger.warning('Miller not available via Winget, trying alternative...');
      return false;
    }
  }

  static async installWithScoop() {
    try {
      logger.info('Installing Miller via Scoop...');
      await execAsync('scoop install miller');
      logger.success('Miller installed successfully via Scoop');
      return true;
    } catch (error) {
      logger.error(`Scoop installation failed: ${error.message}`);
      return false;
    }
  }

  // ===== WINDOWS SYSTEM UTILITIES =====
  static async getWindowsProcessInfo(port) {
    try {
      // Get process using the port
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');

      if (lines.length > 0 && lines[0]) {
        const parts = lines[0].trim().split(/\s+/);
        const pid = parts[parts.length - 1];

        // Get process name from PID
        try {
          const { stdout: processInfo } = await execAsync(
            `tasklist /fi "PID eq ${pid}" /fo csv /nh`
          );
          const processName = processInfo.split(',')[0].replace(/"/g, '');
          return `${processName} (PID: ${pid})`;
        } catch {
          return `PID: ${pid}`;
        }
      }
    } catch (error) {
      return 'Unknown process';
    }
  }

  static async isDockerDesktopRunning() {
    try {
      const { stdout } = await execAsync(
        'tasklist /fi "imagename eq Docker Desktop.exe" /fo csv /nh'
      );
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  static async getWindowsServices() {
    try {
      const { stdout } = await execAsync('sc query type= service state= all');
      return stdout;
    } catch (error) {
      logger.warning(`Could not get Windows services: ${error.message}`);
      return '';
    }
  }

  // ===== WINDOWS PATH UTILITIES =====
  static normalizePath(windowsPath) {
    // Convert Windows paths to Docker-compatible format
    return windowsPath
      .replace(/\\/g, '/')
      .replace(/^([A-Za-z]):/, (match, drive) => `/${drive.toLowerCase()}`);
  }

  static getWindowsDockerPath(localPath) {
    // Handle Windows Docker Desktop path mapping
    if (localPath.match(/^[A-Za-z]:\\/)) {
      // Convert C:\Users\... to /c/Users/...
      return this.normalizePath(localPath);
    }
    return localPath;
  }

  // ===== WINDOWS NETWORK UTILITIES =====
  static async getNetworkInfo() {
    try {
      const { stdout } = await execAsync('ipconfig /all');
      return stdout;
    } catch (error) {
      logger.warning(`Could not get network info: ${error.message}`);
      return '';
    }
  }

  // ===== WINDOWS TERMINAL UTILITIES =====
  static async setupWindowsTerminal() {
    logger.info('Windows Terminal detected');

    // Check if Windows Terminal supports advanced features
    try {
      const { stdout } = await execAsync('wt --version');
      logger.success(`Windows Terminal version: ${stdout.trim()}`);
      return true;
    } catch {
      logger.info('Classic Command Prompt detected - some features may be limited');
      return false;
    }
  }

  // ===== WINDOWS DOCKER DESKTOP HELPERS =====
  static async checkDockerDesktopRequirements() {
    const issues = [];

    // Check if Docker Desktop is installed
    if (!(await this.isDockerDesktopRunning())) {
      issues.push('Docker Desktop is not running');
    }

    // Check WSL2 (for Docker Desktop)
    try {
      await execAsync('wsl --version');
      logger.success('WSL2 is available');
    } catch {
      issues.push('WSL2 may not be properly configured');
    }

    // Check Hyper-V (alternative to WSL2)
    try {
      const { stdout } = await execAsync(
        'powershell "Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All | Select-Object State"'
      );
      if (stdout.includes('Enabled')) {
        logger.success('Hyper-V is enabled');
      }
    } catch {
      // Hyper-V check failed, but not critical
    }

    return issues;
  }

  // ===== WINDOWS ENVIRONMENT SETUP =====
  static async setupWindowsEnvironment() {
    logger.header('Windows Environment Setup');

    // Check Docker Desktop requirements
    const issues = await this.checkDockerDesktopRequirements();

    if (issues.length > 0) {
      logger.warning('Windows environment issues detected:');
      issues.forEach(issue => logger.plain(`  • ${issue}`));
      console.log();
      logger.info('Please ensure Docker Desktop is properly installed and running.');
      logger.info('Visit: https://docs.docker.com/desktop/windows/install/');
      return false;
    }

    // Setup Windows Terminal if available
    await this.setupWindowsTerminal();

    return true;
  }
}

module.exports = WindowsUtils;
