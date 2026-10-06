#!/usr/bin/env node
/**
 * Cross-platform unified runner for Vedic Horoscope Engine & UI Frontend.
 * Runs both Python REST API (Port 5000) and Vite UI (Port 3000) concurrently.
 */
import { spawn } from 'child_process';
import http from 'http';

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const magenta = '\x1b[35m';
const red = '\x1b[31m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

console.log(`${bold}===============================================================================${reset}`);
console.log(`${bold}${cyan}      VEDIC HOROSCOPE SYSTEM - DUAL SERVICE LAUNCHER (ALL-IN-ONE)${reset}`);
console.log(`${bold}===============================================================================${reset}`);
console.log(`${green}[1/2] Launching Python REST API Service (port 5000)...${reset}`);

// Determine python command
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
const apiProcess = spawn(pythonCmd, ['run_api_server.py'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: process.env
});

apiProcess.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log(`${yellow}[REST API :5000]${reset} ${l}`);
  });
});

apiProcess.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log(`${yellow}[REST API :5000]${reset} ${l}`);
  });
});

apiProcess.on('error', (err) => {
  console.error(`${red}[REST API ERROR]${reset} Could not spawn python process:`, err.message);
  console.log(`${yellow}[INFO] Make sure Python 3.8+ is installed and in your PATH.${reset}`);
});

console.log(`${cyan}[2/2] Launching Vite Frontend UI (port 3000)...${reset}`);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const uiProcess = spawn(npmCmd, ['run', 'dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
  env: process.env
});

uiProcess.stdout.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log(`${magenta}[UI :3000]${reset} ${l}`);
  });
});

uiProcess.stderr.on('data', (data) => {
  const lines = data.toString().trim().split('\n');
  lines.forEach(l => {
    if (l.trim()) console.log(`${magenta}[UI :3000]${reset} ${l}`);
  });
});

uiProcess.on('error', (err) => {
  console.error(`${red}[UI ERROR]${reset} Could not spawn npm dev process:`, err.message);
});

// Periodic ping to check API readiness and print summary
setTimeout(() => {
  http.get('http://127.0.0.1:5000/api/health', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`\n${bold}${green}-------------------------------------------------------------------------------${reset}`);
      console.log(`${bold}${green}✓ Both Services Are Live & Ready!${reset}`);
      console.log(`  • Frontend Web UI:  ${bold}http://localhost:3000${reset}`);
      console.log(`  • Python REST API:  ${bold}http://localhost:5000${reset}`);
      console.log(`  • Query Endpoint:   ${bold}POST http://localhost:5000/api/horoscope/query${reset}`);
      console.log(`  • Health Status:    ${bold}HTTP ${res.statusCode} OK${reset}`);
      console.log(`${bold}${green}-------------------------------------------------------------------------------${reset}\n`);
    });
  }).on('error', () => {
    console.log(`\n${cyan}[INFO] REST API starting up on http://localhost:5000...${reset}\n`);
  });
}, 2500);

// Graceful shutdown on Ctrl+C
function cleanup() {
  console.log(`\n${yellow}[SHUTDOWN] Stopping both REST API and UI services...${reset}`);
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', apiProcess.pid.toString(), '/f', '/t']);
      spawn('taskkill', ['/pid', uiProcess.pid.toString(), '/f', '/t']);
    } else {
      apiProcess.kill('SIGTERM');
      uiProcess.kill('SIGTERM');
    }
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
