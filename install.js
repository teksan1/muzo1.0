#!/usr/bin/env node

/**
 * Muzo1.0 Universal Installation Script
 * Cross-platform installer for Windows, macOS, and Linux
 * Detects OS, checks dependencies, and installs Muzo1.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}=== ${msg} ===${colors.reset}\n`),
  step: (msg) => console.log(`${colors.bright}${colors.cyan}→${colors.reset} ${msg}`),
};

// Detect OS
function getOS() {
  const platform = os.platform();
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

// Check if command exists
function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { shell: '/bin/bash', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Run command with error handling
function runCommand(cmd, errorMsg = 'Command failed') {
  try {
    execSync(cmd, { stdio: 'inherit', shell: true });
    return true;
  } catch (error) {
    log.error(`${errorMsg}: ${error.message}`);
    return false;
  }
}

// Check dependencies
function checkDependencies() {
  log.title('Checking Dependencies');

  const deps = {
    git: { cmd: 'git --version', required: true },
    node: { cmd: 'node --version', required: true },
    npm: { cmd: 'npm --version', required: true },
    rust: { cmd: 'rustc --version', required: true },
  };

  const missing = [];

  for (const [name, { cmd, required }] of Object.entries(deps)) {
    try {
      const version = execSync(cmd, { encoding: 'utf-8' }).trim();
      log.success(`${name}: ${version}`);
    } catch {
      if (required) {
        missing.push(name);
        log.error(`${name}: NOT FOUND (REQUIRED)`);
      } else {
        log.warn(`${name}: NOT FOUND (optional)`);
      }
    }
  }

  return missing;
}

// Install dependencies based on OS
function installDependencies() {
  const osType = getOS();
  log.title(`Installing System Dependencies (${osType})`);

  const installCommands = {
    linux: {
      debian: {
        check: () => fs.existsSync('/etc/debian_version'),
        install: () => {
          log.step('Detected Debian/Ubuntu');
          runCommand('sudo apt-get update', 'Failed to update apt');
          runCommand(
            'sudo apt-get install -y git nodejs npm rustc build-essential libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev',
            'Failed to install Debian dependencies'
          );
        },
      },
      arch: {
        check: () => fs.existsSync('/etc/arch-release'),
        install: () => {
          log.step('Detected Arch Linux');
          runCommand('sudo pacman -Syu --noconfirm', 'Failed to update pacman');
          runCommand(
            'sudo pacman -S --noconfirm git nodejs npm rustup base-devel webkit2gtk',
            'Failed to install Arch dependencies'
          );
        },
      },
      fedora: {
        check: () => fs.existsSync('/etc/fedora-release'),
        install: () => {
          log.step('Detected Fedora/RHEL');
          runCommand('sudo dnf update -y', 'Failed to update dnf');
          runCommand(
            'sudo dnf install -y git nodejs npm rustc gcc webkit2gtk3-devel openssl-devel libayatana-appindicator-devel librsvg2-devel',
            'Failed to install Fedora dependencies'
          );
        },
      },
    },
    macos: {
      install: () => {
        log.step('Detected macOS');
        
        // Check for Homebrew
        if (!commandExists('brew')) {
          log.step('Installing Homebrew...');
          runCommand(
            '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
            'Failed to install Homebrew'
          );
        }

        runCommand('brew update', 'Failed to update Homebrew');
        runCommand(
          'brew install git node rustup-init webkit2gtk openssl librsvg',
          'Failed to install macOS dependencies'
        );
      },
    },
    windows: {
      install: () => {
        log.step('Detected Windows');
        log.warn('Please install the following using Chocolatey or manually:');
        console.log('  • Git: https://git-scm.com/download/win');
        console.log('  • Node.js: https://nodejs.org/');
        console.log('  • Rust: https://rustup.rs/');
        console.log('  • Visual Studio Build Tools or Visual Studio Community');
        log.info('After installing dependencies, run this script again.');
        process.exit(1);
      },
    },
  };

  const osType = getOS();

  if (osType === 'linux') {
    for (const [distro, { check, install }] of Object.entries(installCommands.linux)) {
      if (check()) {
        install();
        return;
      }
    }
    log.error('Could not detect Linux distribution. Please install dependencies manually.');
    console.log('Required: git, nodejs, npm, rustc, build-essential, libwebkit2gtk-4.1-dev, libssl-dev');
  } else if (osType === 'macos') {
    installCommands.macos.install();
  } else if (osType === 'windows') {
    installCommands.windows.install();
  }
}

// Clone or pull repository
function setupRepository() {
  log.title('Setting Up Repository');

  const repoUrl = 'https://github.com/teksan1/muzo1.0.git';
  const targetDir = path.join(os.homedir(), '.muzo1.0');

  if (fs.existsSync(targetDir)) {
    log.warn(`Repository already exists at ${targetDir}`);
    log.step('Pulling latest changes...');
    runCommand(`cd "${targetDir}" && git pull origin main`, 'Failed to pull repository');
  } else {
    log.step(`Cloning repository to ${targetDir}...`);
    if (!runCommand(`git clone ${repoUrl} "${targetDir}"`, 'Failed to clone repository')) {
      process.exit(1);
    }
  }

  return targetDir;
}

// Install npm dependencies
function installNpmDependencies(repoDir) {
  log.title('Installing NPM Dependencies');

  log.step('Running npm install...');
  const installCmd = os.platform() === 'win32'
    ? `cd "${repoDir}" && npm install --legacy-peer-deps`
    : `cd "${repoDir}" && npm install --legacy-peer-deps`;

  if (!runCommand(installCmd, 'Failed to install npm dependencies')) {
    log.error('Installation failed. You may need to manually install or troubleshoot.');
    return false;
  }

  return true;
}

// Build application
function buildApplication(repoDir) {
  log.title('Building Application');

  log.step('Building React bundle...');
  if (!runCommand(`cd "${repoDir}" && npm run build:react`, 'Failed to build React')) {
    return false;
  }

  log.step('Building production binary...');
  const osType = getOS();
  let buildCmd;

  if (osType === 'linux') {
    buildCmd = `cd "${repoDir}" && npm run tauri:build:linux`;
  } else if (osType === 'macos') {
    buildCmd = `cd "${repoDir}" && npm run tauri:build:mac`;
  } else if (osType === 'windows') {
    buildCmd = `cd "${repoDir}" && npm run tauri:build:win`;
  }

  if (!runCommand(buildCmd, 'Failed to build application')) {
    return false;
  }

  return true;
}

// Create desktop shortcut/entry
function createDesktopEntry(repoDir) {
  log.title('Creating Desktop Entry');

  const osType = getOS();

  if (osType === 'linux') {
    const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=Muzo1.0
Exec=${repoDir}/src/app/target/release/muzo1-0
Icon=muzo
Categories=Audio;Video;Utility;
StartupNotify=true
StartupWMClass=muzo
`;

    const desktopDir = path.join(os.homedir(), '.local/share/applications');
    if (!fs.existsSync(desktopDir)) {
      fs.mkdirSync(desktopDir, { recursive: true });
    }

    fs.writeFileSync(path.join(desktopDir, 'muzo1.0.desktop'), desktopEntry);
    log.success('Desktop entry created');
  } else if (osType === 'macos') {
    log.info('Application bundle created at src/app/target/release/bundle/macos/');
  } else if (osType === 'windows') {
    log.info('Windows installer created at src/app/target/release/bundle/msi/');
  }
}

// Create start script
function createStartScript(repoDir) {
  log.title('Creating Start Script');

  const osType = getOS();
  const binDir = path.join(os.homedir(), '.local/bin');

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  if (osType === 'windows') {
    const batchScript = `@echo off
cd "${repoDir}"
npm run tauri:dev
`;
    fs.writeFileSync(path.join(binDir, 'muzo1.0.bat'), batchScript);
    log.success(`Start script created: ${path.join(binDir, 'muzo1.0.bat')}`);
  } else {
    const bashScript = `#!/bin/bash
cd "${repoDir}"
npm run tauri:dev
`;
    const scriptPath = path.join(binDir, 'muzo1.0');
    fs.writeFileSync(scriptPath, bashScript);
    fs.chmodSync(scriptPath, 0o755);
    log.success(`Start script created: ${scriptPath}`);
  }
}

// Main installation flow
async function main() {
  console.clear();
  log.title('Muzo1.0 Universal Installer');

  const osType = getOS();
  log.info(`Detected OS: ${osType.toUpperCase()}`);

  // Check dependencies
  const missing = checkDependencies();

  if (missing.length > 0) {
    log.warn(`Missing required dependencies: ${missing.join(', ')}`);
    log.step('Attempting to install missing dependencies...');
    installDependencies();
  } else {
    log.success('All required dependencies are installed!');
  }

  // Setup repository
  const repoDir = setupRepository();

  // Install npm packages
  if (!installNpmDependencies(repoDir)) {
    process.exit(1);
  }

  // Build application
  if (!buildApplication(repoDir)) {
    log.warn('Build completed with errors. Check the output above.');
  }

  // Create desktop entry and start script
  createDesktopEntry(repoDir);
  createStartScript(repoDir);

  log.title('Installation Complete! 🎉');
  log.success('Muzo1.0 has been successfully installed!');
  console.log(`\n${colors.bright}Next steps:${colors.reset}`);
  console.log(`  1. Launch: muzo1.0`);
  console.log(`  2. Or navigate to: ${repoDir}`);
  console.log(`  3. Run: npm run tauri:dev (for development)\n`);
}

main().catch((error) => {
  log.error(`Installation failed: ${error.message}`);
  process.exit(1);
});
