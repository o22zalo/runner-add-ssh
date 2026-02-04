/**
 * Windows Executor
 * 
 * Handles SSH installation, configuration, and service management on Windows.
 */

const path = require('path');
const { spawnAsync } = require('../../adapters/process');
const { writeFile, ensureDir } = require('../../adapters/fs');
const { ProcessError } = require('../../utils/errors');

/**
 * Install OpenSSH Server on Windows
 * 
 * @param {Object} config - Configuration
 * @param {Logger} logger - Logger instance
 */
async function installSSH(config, logger) {
  try {
    // Check if already installed
    logger.debug('Checking OpenSSH Server installation status...');
    const checkCmd = `Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'`;
    
    const checkResult = await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      checkCmd
    ], { logger });

    const checkOutput = [checkResult.stdout, checkResult.stderr].join('\n');
    if (checkOutput.includes('State        : Installed')) {
      logger.debug('OpenSSH Server already installed');
      return;
    }

    // Install OpenSSH Server
    logger.debug('Installing OpenSSH Server...');
    const installCmd = `Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0`;
    
    await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      installCmd
    ], { logger });

    logger.debug('OpenSSH Server installed successfully');
  } catch (error) {
    throw new ProcessError(`Failed to install OpenSSH Server: ${error.message}`);
  }
}

/**
 * Configure SSH Server on Windows
 * 
 * @param {Object} config - Configuration
 * @param {Logger} logger - Logger instance
 */
async function configureSSH(config, logger) {
  const sshdConfigPath = 'C:\\ProgramData\\ssh\\sshd_config';

  try {
    // Ensure ProgramData/ssh directory exists
    await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `New-Item -ItemType Directory -Force -Path "C:\\ProgramData\\ssh"`
    ], { logger });

    // Generate sshd_config content
    const sshdConfig = generateSSHDConfig(config);

    // Write config to temp file
    const tempConfigPath = path.join(config.cwd, '.runner-data', 'tmp', 'sshd_config_win');
    await ensureDir(path.dirname(tempConfigPath));
    await writeFile(tempConfigPath, sshdConfig);

    // Copy to ProgramData with PowerShell
    logger.debug(`Writing sshd_config to ${sshdConfigPath}...`);
    const copyCmd = `Copy-Item -Path "${tempConfigPath.replace(/\//g, '\\')}" -Destination "${sshdConfigPath}" -Force`;
    
    await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      copyCmd
    ], { logger });

    // Configure firewall rule
    logger.debug(`Configuring firewall for port ${config.port}...`);
    const firewallCmd = `New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -DisplayName "OpenSSH Server (sshd)" -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort ${config.port} -ErrorAction SilentlyContinue`;
    
    await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      firewallCmd
    ], { logger });

    logger.debug('SSH configuration applied successfully');
  } catch (error) {
    throw new ProcessError(`Failed to configure SSH: ${error.message}`);
  }
}

/**
 * Start SSH service on Windows
 * 
 * @param {Object} config - Configuration
 * @param {Logger} logger - Logger instance
 */
async function startSSH(config, logger) {
  try {
    // Set service to automatic start
    logger.debug('Setting SSH service to automatic start...');
    await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Set-Service -Name sshd -StartupType Automatic`
    ], { logger });

    // Start the service
    logger.debug('Starting SSH service...');
    await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Service sshd`
    ], { logger });

    // Verify service is running
    logger.debug('Verifying SSH service status...');
    const statusResult = await spawnAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Get-Service sshd | Select-Object -ExpandProperty Status`
    ], { logger });

    const statusOutput = [statusResult.stdout, statusResult.stderr].join('\n');
    if (!statusOutput.includes('Running')) {
      throw new Error('SSH service failed to start');
    }

    logger.debug('SSH service is running');
  } catch (error) {
    throw new ProcessError(`Failed to start SSH service: ${error.message}`);
  }
}

/**
 * Generate sshd_config content for Windows
 * 
 * @param {Object} config - Configuration
 * @returns {string} sshd_config content
 */
function generateSSHDConfig(config) {
  const allowUsersArr = config.allowUsers.split(' ').filter(u => u.trim());
  const forceCommandLine = !config.disableForceCwd 
    ? `ForceCommand cmd /c "cd /d ${config.defaultCwd.replace(/\//g, '\\\\')} && cmd"`
    : '';

  return `# SSH Server Configuration - Generated by runner-add-ssh
# Port
Port ${config.port}

# Authentication
PubkeyAuthentication yes
PasswordAuthentication no
ChallengeResponseAuthentication no

# Security
PermitRootLogin no
StrictModes yes
MaxAuthTries 3
MaxSessions 10

# Allowed users
AllowUsers ${allowUsersArr.join(' ')}

# Windows-specific
Subsystem sftp sftp-server.exe

# Logging
SyslogFacility AUTH
LogLevel INFO

# Default working directory
${forceCommandLine}

# Performance
UseDNS no
`;
}

module.exports = {
  installSSH,
  configureSSH,
  startSSH
};
