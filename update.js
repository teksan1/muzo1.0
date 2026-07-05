#!/usr/bin/env node

/**
 * Muzo1.0 Update Script
 * Automatically updates Muzo1.0 to the latest version from GitHub
 * Handles version checking, pulling updates, rebuilding, and restart
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const os = require('os');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}\n`),
  step: (msg) => console.log(`${colors.bright}${colors.cyan}→${colors.reset} ${msg}`),
};

// Get local version
function getLocalVersion() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version;
    }
  } catch (error) {
    log.error(`Failed to read local version: ${error.message}`);
  }
  return '0.0.0';
}

// Get remote version from GitHub API
function getRemoteVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/teksan1/muzo1.0/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Muzo1.0-Update-Script',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    https
      .request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.tag_name) {
              resolve(json.tag_name.replace(/^v/, ''));
            } else if (json.message) {
              reject(new Error(json.message));
            } else {
              reject(new Error('Could not find release information'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse API response: ${error.message}`));
          }
        });
      })
      .on('error', (error) => {
        reject(error);
      })
      .end();
  });
}

// Compare versions
function compareVersions(local, remote) {
  const localParts = local.split('.').map(Number);
  const remoteParts = remote.split('.').map(Number);

  for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
    const l = localParts[i] || 0;
    const r = remoteParts[i] || 0;

    if (l < r) return -1; // local is older
    if (l > r) return 1;  // local is newer
  }

  return 0; // versions are equal
}

// Run command with error handling
function runCommand(cmd, errorMsg = 'Command failed', showOutput = true) {
  try {
    const options = showOutput ? { stdio: 'inherit', shell: true } : { shell: true, stdio: 'pipe' };
    execSync(cmd, options);
    return true;
  } catch (error) {
    log.error(`${errorMsg}: ${error.message}`);
    return false;
  }
}

// Backup current state
function backupCurrentState() {
  log.title('Creating Backup');

  const backupDir = path.join(os.homedir(), '.muzo1.0-backup');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup-${timestamp}`;

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Backup key directories and files
    const itemsToBackup = ['package.json', 'package-lock.json', 'src', '.env'];

    for (const item of itemsToBackup) {
      if (fs.existsSync(item)) {
        const backupPath = path.join(backupDir, backupName);
        if (!fs.existsSync(backupPath)) {
          fs.mkdirSync(backupPath, { recursive: true });
        }

        const cmd =
          os.platform() === 'win32'
            ? `xcopy "${item}" "${path.join(backupPath, item)}" /E /I /Y`
            : `cp -r "${item}" "${path.join(backupPath, item)}"`;

        try {
          execSync(cmd, { stdio: 'pipe' });
          log.success(`Backed up: ${item}`);
        } catch {
          log.warn(`Could not backup: ${item}`);
        }
      }
    }

    log.success(`Backup created at: ${path.join(backupDir, backupName)}`);
    return path.join(backupDir, backupName);
  } catch (error) {
    log.warn(`Backup creation failed: ${error.message}`);
    return null;
  }
}

// Pull latest changes from GitHub
function pullLatestChanges() {
  log.title('Pulling Latest Changes');

  log.step('Fetching from GitHub...');
  if (!runCommand('git fetch origin main', 'Failed to fetch from GitHub')) {
    return false;
  }

  log.step('Pulling main branch...');
  if (!runCommand('git pull origin main', 'Failed to pull latest changes')) {
    return false;
  }

  log.success('Latest changes pulled successfully');
  return true;
}

// Clean dependencies
function cleanDependencies() {
  log.title('Cleaning Dependencies');

  log.step('Removing node_modules...');
  const cmd =
    os.platform() === 'win32'
      ? 'rmdir /s /q node_modules'
      : 'rm -rf node_modules';

  try {
    execSync(cmd, { stdio: 'pipe' });
    log.success('node_modules removed');
  } catch {
    log.warn('Could not fully remove node_modules (may be locked)');
  }

  return true;
}

// Install dependencies
function installDependencies() {
  log.title('Installing Dependencies');

  log.step('Running npm install...');
  if (!runCommand('npm install --legacy-peer-deps', 'Failed to install npm dependencies')) {
    return false;
  }

  log.success('Dependencies installed');
  return true;
}

// Build application
function buildApplication() {
  log.title('Building Application');

  log.step('Building React bundle...');
  if (!runCommand('npm run build:react', 'Failed to build React')) {
    return false;
  }

  log.step('Building production binary...');
  const osType = os.platform();
  let buildCmd;

  if (osType === 'linux') {
    buildCmd = 'npm run tauri:build:linux';
  } else if (osType === 'darwin') {
    buildCmd = 'npm run tauri:build:mac';
  } else if (osType === 'win32') {
    buildCmd = 'npm run tauri:build:win';
  } else {
    log.error('Unsupported OS for building');
    return false;
  }

  if (!runCommand(buildCmd, 'Failed to build application')) {
    return false;
  }

  log.success('Application built successfully');
  return true;
}

// Get changelog from GitHub
function getChangelog(localVersion, remoteVersion) {
  log.title('Changelog');

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/teksan1/muzo1.0/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'Muzo1.0-Update-Script',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    https
      .request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.body) {
              console.log(json.body);
            } else {
              log.info('No detailed changelog available');
            }
          } catch {
            log.info('Could not retrieve changelog');
          }
          resolve();
        });
      })
      .on('error', () => {
        log.warn('Could not fetch changelog');
        resolve();
      })
      .end();
  });
}

// Verify update
function verifyUpdate() {
  log.title('Verifying Update');

  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    log.success(`Updated to version: ${packageJson.version}`);
    return true;
  } catch (error) {
    log.error(`Verification failed: ${error.message}`);
    return false;
  }
}

// Restart application
function restartApplication() {
  const osType = os.platform();
  const responses = ['y', 'yes'];
  const input = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  input.question(
    `${colors.bright}Would you like to restart Muzo1.0 now? (y/n): ${colors.reset}`,
    (answer) => {
      input.close();

      if (responses.includes(answer.toLowerCase())) {
        log.step('Restarting Muzo1.0...');

        try {
          if (osType === 'win32') {
            execSync('npm run tauri:dev', { stdio: 'inherit', shell: true });
          } else {
            execSync('npm run tauri:dev', { stdio: 'inherit', shell: true });
          }
        } catch {
          log.info('Application closed');
        }
      } else {
        log.info('To restart later, run: npm run tauri:dev');
      }

      process.exit(0);
    }
  );
}

// Main update flow
async function main() {
  console.clear();
  log.title('Muzo1.0 Updater');

  log.step('Checking versions...');

  const localVersion = getLocalVersion();
  log.info(`Local version: ${colors.bright}${localVersion}${colors.reset}`);

  let remoteVersion;
  try {
    remoteVersion = await getRemoteVersion();
    log.info(`Remote version: ${colors.bright}${remoteVersion}${colors.reset}`);
  } catch (error) {
    log.error(`Failed to fetch remote version: ${error.message}`);
    log.info('Make sure you have internet connection and try again.');
    process.exit(1);
  }

  const versionComparison = compareVersions(localVersion, remoteVersion);

  if (versionComparison === 0) {
    log.success('You are already on the latest version!');
    process.exit(0);
  } else if (versionComparison > 0) {
    log.warn('You are on a newer version than the latest release.');
    log.info('This might be a development version.');
    process.exit(0);
  }

  log.warn(`An update is available: ${localVersion} → ${remoteVersion}`);

  // Show changelog
  await getChangelog(localVersion, remoteVersion);

  // Confirm update
  const input = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  input.question(
    `${colors.bright}${colors.yellow}Do you want to update? (y/n): ${colors.reset}`,
    async (answer) => {
      input.close();

      if (!['y', 'yes'].includes(answer.toLowerCase())) {
        log.info('Update cancelled.');
        process.exit(0);
      }

      // Backup current state
      const backupPath = backupCurrentState();

      // Pull latest changes
      if (!pullLatestChanges()) {
        log.error('Failed to pull latest changes.');
        if (backupPath) {
          log.info(`Backup available at: ${backupPath}`);
        }
        process.exit(1);
      }

      // Clean, install, and build
      cleanDependencies();

      if (!installDependencies()) {
        log.error('Failed to install dependencies.');
        if (backupPath) {
          log.warn(`Restore backup from: ${backupPath}`);
        }
        process.exit(1);
      }

      if (!buildApplication()) {
        log.error('Failed to build application.');
        if (backupPath) {
          log.warn(`Restore backup from: ${backupPath}`);
        }
        process.exit(1);
      }

      // Verify update
      if (!verifyUpdate()) {
        log.error('Update verification failed.');
        if (backupPath) {
          log.warn(`Restore backup from: ${backupPath}`);
        }
        process.exit(1);
      }

      log.title('Update Complete! 🎉');
      log.success(`Muzo1.0 has been updated to ${remoteVersion}`);

      // Offer to restart
      restartApplication();
    }
  );
}

main().catch((error) => {
  log.error(`Update failed: ${error.message}`);
  process.exit(1);
});
