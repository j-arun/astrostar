#!/usr/bin/env node
/**
 * Cross-platform unified runner for Vedic Horoscope Engine & UI Frontend.
 * Runs the unified Express + Vite server natively on Port 3000 (no second port required).
 */
import { spawn } from 'child_process';
import http from 'http';

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

console.log(`${bold}===============================================================================${reset}`);
console.log(`${bold}${cyan}      VEDIC HOROSCOPE SYSTEM - UNIFIED SINGLE-PORT LAUNCHER (:3000)${reset}`);
console.log(`${bold}===============================================================================${reset}`);
console.log(`${green}[1/1] Launching Unified Web UI & REST API Server (port 3000)...${reset}`);

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const serverProcess = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
});

serverProcess.on('error', (err) => {
  console.error(`[SERVER ERROR] Could not spawn unified server:`, err.message);
});

setTimeout(() => {
  http.get('http://127.0.0.1:3000/api/health', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`\n${bold}${green}-------------------------------------------------------------------------------${reset}`);
      console.log(`${bold}${green}✓ Unified Server Is Live & Ready on Port 3000!${reset}`);
      console.log(`  • Frontend Web UI:  ${bold}http://localhost:3000${reset}`);
      console.log(`  • Horoscope API:    ${bold}POST http://localhost:3000/api/horoscope/query${reset}`);
      console.log(`  • Content API:      ${bold}GET  http://localhost:3000/api/content${reset}`);
      console.log(`  • Health Status:    ${bold}HTTP ${res.statusCode} OK${reset}`);
      console.log(`${bold}${green}-------------------------------------------------------------------------------${reset}\n`);
    });
  }).on('error', () => {
    console.log(`\n${cyan}[INFO] Unified server starting up on http://localhost:3000...${reset}\n`);
  });
}, 2500);

function cleanup() {
  console.log(`\n${yellow}[SHUTDOWN] Stopping unified server on port 3000...${reset}`);
  try {
    if (process.platform === 'win32' && serverProcess.pid) {
      spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
    } else {
      serverProcess.kill('SIGTERM');
    }
  } catch (e) {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
