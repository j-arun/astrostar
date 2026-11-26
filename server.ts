import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { registerApiMiddlewares } from './serverApi.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env and .env.local (if present) into process.env
dotenv.config({ path: path.resolve(__dirname, '.env') });
const envLocalPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string') env[k] = v;
  }

  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  let vite: any = null;
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
  } else {
    try {
      const nodeModule: any = await import('node:module');
      if (typeof nodeModule.registerHooks === 'function') {
        nodeModule.registerHooks({
          load(url: string, context: any, nextLoad: any) {
            if (url.includes('?raw') || url.endsWith('.txt')) {
              const filePath = fileURLToPath(url.split('?')[0]);
              const rawText = fs.readFileSync(filePath, 'utf-8');
              return {
                format: 'module',
                shortCircuit: true,
                source: `export default ${JSON.stringify(rawText)};`,
              };
            }
            return nextLoad(url, context);
          },
        });
      }
    } catch (hookErr) {
      console.warn('[Server] Could not register raw text loader hook:', hookErr);
    }
  }

  const loadModule = async (modPath: string) => {
    const cleanRel = modPath.replace(/^\/+/, '');
    if (vite) {
      return await vite.ssrLoadModule('/' + cleanRel);
    }
    const absPath = path.resolve(__dirname, cleanRel);
    return await import(pathToFileURL(absPath).href);
  };

  // Mount ALL REST API & proxy routes natively on port 3000 before Vite / static SPA fallback.
  // Global express.json() is intentionally omitted so raw-stream handlers in serverApi.ts work intact.
  registerApiMiddlewares(app, {
    rootDir: __dirname,
    env,
    loadModule,
  });

  if (vite) {
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get(/^(?!\/api(?:\/|$)|\/docs(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n===============================================================================');
    console.log(`  VEDIC HOROSCOPE SYSTEM — UNIFIED SERVER ON PORT ${PORT} (${isProd ? 'PRODUCTION' : 'DEV'})`);
    console.log(`  • Web UI & Workbench:  http://localhost:${PORT}`);
    console.log(`  • Horoscope REST API:  http://localhost:${PORT}/api/horoscope/query`);
    console.log(`  • Original Source API: http://localhost:${PORT}/api/content`);
    console.log(`  • Natal Dump API:      http://localhost:${PORT}/api/natal/dump`);
    console.log(`  • Transit Dump API:    http://localhost:${PORT}/api/transit/dump`);
    console.log(`  • Transit Query API:   http://localhost:${PORT}/api/transit/query`);
    console.log(`  • Health Check:        http://localhost:${PORT}/api/health`);
    console.log('===============================================================================\n');
  });

  // Disable request timeout so long local Ollama (14B) batch inferences never drop prematurely
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.keepAliveTimeout = 620_000;
}

startServer().catch((err) => {
  console.error('[Server Fatal Error]', err);
  process.exit(1);
});
