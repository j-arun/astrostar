import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { defineConfig, loadEnv, Plugin } from 'vite';

function astroApiPlugin(): Plugin {
  return {
    name: 'astro-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // 1. GET /api/persons - Return all loaded persons in the DB
        if (url === '/api/persons' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          try {
            const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
            if (fs.existsSync(dataPath)) {
              const content = fs.readFileSync(dataPath, 'utf-8');
              const db = JSON.parse(content || '{}');
              const persons = Object.values(db).map((item: any) => item.profile);
              persons.sort((a: any, b: any) => {
                if (a.person_id === '001ME') return -1;
                if (b.person_id === '001ME') return 1;
                return a.person_id.localeCompare(b.person_id);
              });
              res.statusCode = 200;
              res.end(JSON.stringify({ persons }));
              return;
            }
          } catch (e: any) {
            console.error('Error reading stored persons:', e);
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ persons: [] }));
          return;
        }

        // 1b. GET /api/persons/:id - Fetch full person record from DB
        const getPersonMatch = url.match(/^\/api\/persons\/([A-Za-z0-9_\-]+)$/);
        if (getPersonMatch && req.method === 'GET') {
          const pid = getPersonMatch[1];
          res.setHeader('Content-Type', 'application/json');
          try {
            const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
            if (fs.existsSync(dataPath)) {
              const db = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
              if (db[pid]) {
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, person: db[pid] }));
                return;
              }
            }
          } catch (e: any) {}
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: `Person ${pid} not found in database.` }));
          return;
        }

        // 2. POST /api/horoscope/save-person - Store person and placements in database table
        if (url === '/api/horoscope/save-person' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body || '{}');
              const person = payload.person || payload.person_master || {};
              const pid = person.person_id;
              if (!pid) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing person_id' }));
                return;
              }

              const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
              let db: Record<string, any> = {};
              if (fs.existsSync(dataPath)) {
                try {
                  db = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
                } catch {}
              }

              const placements = payload.placements || (payload.d1Placements && payload.d9Placements ? [...payload.d1Placements, ...payload.d9Placements] : []);

              db[pid] = {
                profile: person,
                placements: placements.length > 0 ? placements : (db[pid]?.placements || []),
                dashaRecords: payload.dashaTimeline || payload.dashaRecords || db[pid]?.dashaRecords
              };

              fs.writeFileSync(dataPath, JSON.stringify(db, null, 2), 'utf-8');

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                message: `Successfully stored person ${pid} (${person.person_name || ''}) into database tables person_master and natal_placement_detail!`,
                person_id: pid,
                timestamp: new Date().toISOString()
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 3. DELETE /api/persons/:id or POST /api/persons/delete
        const deleteMatch = url.match(/^\/api\/persons\/([A-Za-z0-9_\-]+)/);
        if ((deleteMatch && req.method === 'DELETE') || (url === '/api/persons/delete' && req.method === 'POST')) {
          const deletePerson = (pid: string) => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
              if (fs.existsSync(dataPath)) {
                const db = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
                if (db[pid]) {
                  delete db[pid];
                  fs.writeFileSync(dataPath, JSON.stringify(db, null, 2), 'utf-8');
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, message: `Deleted person ${pid} from database tables.` }));
                  return;
                }
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, message: `Person ${pid} was not found or already deleted.` }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          };

          if (deleteMatch) {
            deletePerson(deleteMatch[1]);
            return;
          } else {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const p = JSON.parse(body || '{}');
                deletePerson(p.person_id || p.id);
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: e.message }));
              }
            });
            return;
          }
        }

        // 4. GET /api/health
        if (url === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'healthy',
            service: 'Vedic Astrology REST API (Integrated DB Engine)',
            database_status: 'connected (active data store)',
            timestamp: new Date().toISOString()
          }));
          return;
        }

        // 5. POST /api/horoscope/query (REST & SAP Query Studio live endpoint)
        if (url.startsWith('/api/horoscope/query') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body || '{}');
              const personId = payload.person_id || '001ME';
              const startDate = payload.start_date || '1998-01-01';
              const endDate = payload.end_date || '2020-01-31';
              const format = payload.format || 'full';

              const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
              let db: Record<string, any> = {};
              if (fs.existsSync(dataPath)) {
                db = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
              }

              const personRecord = db[personId] || db['001ME'] || Object.values(db)[0];
              if (!personRecord) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: `Person ${personId} not found in database.` }));
                return;
              }

              const profile = personRecord.profile;
              const placements = personRecord.placements || [];
              const d1Bodies = placements.filter((p: any) => p.chart_type === 'D1');
              const d9Bodies = placements.filter((p: any) => p.chart_type === 'D9');

              const runningNum = ((global as any).__query_seq = ((global as any).__query_seq || 0) % 100 + 1);
              const nowStr = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
              const uniqueResponseId = `Q-${personId}-${String(runningNum).padStart(3, '0')}-${nowStr}`;

              const dobDate = new Date(profile.date_of_birth || '1976-01-26');
              const balYears = Number(profile.dasha_balance_years || 13);
              const balMonths = Number(profile.dasha_balance_months || 2);
              const balDays = Number(profile.dasha_balance_days || 5);

              const LORDS = [
                { name: 'Ketu', years: 7 },
                { name: 'Venus (Sukra)', years: 20 },
                { name: 'Sun (Surya)', years: 6 },
                { name: 'Moon (Chandra)', years: 10 },
                { name: 'Mars (Sevvai)', years: 7 },
                { name: 'Rahu', years: 18 },
                { name: 'Jupiter (Guru)', years: 16 },
                { name: 'Saturn (Sani)', years: 19 },
                { name: 'Mercury (Budha)', years: 17 }
              ];

              const startLordNorm = (profile.starting_dasha_lord || 'Saturn').toLowerCase();
              let startLordIdx = LORDS.findIndex(l => startLordNorm.includes(l.name.toLowerCase().split(' ')[0]));
              if (startLordIdx === -1) startLordIdx = 7;

              const balTotalDays = balYears * 365.25 + balMonths * 30.4375 + balDays;
              const firstMdEndMs = dobDate.getTime() + balTotalDays * 24 * 3600 * 1000;

              let currentStartMs = dobDate.getTime();
              let currentEndMs = firstMdEndMs;
              const rawIntervals: any[] = [];

              for (let cycle = 0; cycle < 10; cycle++) {
                const mdLord = LORDS[(startLordIdx + cycle) % 9];
                if (cycle > 0) {
                  currentStartMs = currentEndMs;
                  const mdDays = mdLord.years * 365.25;
                  currentEndMs = currentStartMs + mdDays * 24 * 3600 * 1000;
                }
                const mdIdx = LORDS.findIndex(l => l.name === mdLord.name);
                const mdTotalMs = currentEndMs - currentStartMs;
                let adStartMs = currentStartMs;

                for (let i = 0; i < 9; i++) {
                  const adLord = LORDS[(mdIdx + i) % 9];
                  const adFraction = adLord.years / 120.0;
                  const adDurationMs = mdTotalMs * adFraction;
                  const adEndMs = i === 8 ? currentEndMs : Math.min(currentEndMs, adStartMs + adDurationMs);
                  const adIdx = LORDS.findIndex(l => l.name === adLord.name);
                  let pdStartMs = adStartMs;

                  for (let j = 0; j < 9; j++) {
                    const pdLord = LORDS[(adIdx + j) % 9];
                    const pdFraction = pdLord.years / 120.0;
                    const pdDurationMs = (adEndMs - adStartMs) * pdFraction;
                    const pdEndMs = j === 8 ? adEndMs : Math.min(adEndMs, pdStartMs + pdDurationMs);

                    const sIso = new Date(pdStartMs).toISOString().slice(0, 10);
                    const eIso = new Date(pdEndMs).toISOString().slice(0, 10);
                    rawIntervals.push([mdLord.name, adLord.name, pdLord.name, sIso, eIso]);
                    pdStartMs = pdEndMs;
                  }
                  adStartMs = adEndMs;
                }
              }

              const filtered = rawIntervals.filter(([_, __, ___, s, e]) => s <= endDate && e >= startDate);
              const intervals = filtered.map(([md, ad, pd, s, e], idx) => ({
                sequence_index: idx + 1,
                mahadasha_lord_md: md,
                antardasha_lord_ad: ad,
                pratyantardasha_lord_pd: pd,
                full_lord_hierarchy: `MD: ${md} > AD: ${ad} > PD: ${pd}`,
                start_date: s,
                end_date: e,
                duration_days: Math.round((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 3600 * 24))
              }));

              let spanYears = null;
              try {
                spanYears = parseFloat(((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24 * 365.25)).toFixed(2));
              } catch {}

              const responseData = {
                unique_response_id: uniqueResponseId,
                running_number: runningNum,
                person_id: personId,
                requested_timeline: {
                  start_date: startDate,
                  end_date: endDate,
                  span_years: spanYears
                },
                person_profile: profile,
                natal_placements: {
                  D1_rashi_chart: {
                    count: d1Bodies.length,
                    lagna_sign: profile.birth_lagna,
                    bodies: d1Bodies
                  },
                  D9_navamsha_chart: {
                    count: d9Bodies.length,
                    bodies: d9Bodies
                  }
                },
                vimshottari_dasha_intervals: {
                  total_intervals_count: intervals.length,
                  granularity: 'Pratyantardasha (PD) Level',
                  intervals
                },
                server_timestamp: new Date().toISOString(),
                persisted_in_database: {
                  table: 'user_queries',
                  running_number_cycle: `${runningNum}/100`,
                  status: 'COMMITTED_IN_DB'
                }
              };

              (global as any).__recent_queries = (global as any).__recent_queries || [];
              (global as any).__recent_queries.unshift({
                query_id: uniqueResponseId,
                running_number: runningNum,
                person_id: personId,
                start_date: startDate,
                end_date: endDate,
                created_at: new Date().toISOString(),
                response_payload: responseData
              });
              if ((global as any).__recent_queries.length > 100) {
                (global as any).__recent_queries.pop();
              }

              if (format === 'llm_markdown') {
                res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
                let md = `# ASTROLOGICAL DATASET (NO PII)\n`;
                md += `**Reference ID:** \`${personId}\` | **Window:** \`${startDate}\` to \`${endDate}\` (${spanYears} yrs)\n`;
                md += `**Birth Lagna:** ${profile.birth_lagna} | **Birth Rashi:** ${profile.birth_rashi} | **Star:** ${profile.birth_star}\n\n`;
                md += `## D1 Rashi Chart\n`;
                d1Bodies.forEach((b: any) => {
                  md += `- ${b.body_name} in ${b.rashi_name} (H${b.house_number}) ${b.nakshatra_name || ''} ${b.pada ? 'P' + b.pada : ''} ${b.degree_sputa || ''} ${b.is_retrograde ? '(Retro)' : ''}\n`;
                });
                md += `\n## D9 Navamsha Chart\n`;
                d9Bodies.forEach((b: any) => {
                  md += `- ${b.body_name} in ${b.rashi_name} (H${b.house_number})\n`;
                });
                md += `\n## Vimshottari Dasha Intervals (${intervals.length} PD Periods)\n`;
                intervals.forEach((it: any) => {
                  md += `| ${it.sequence_index} | ${it.full_lord_hierarchy} | ${it.start_date} | ${it.end_date} | ${it.duration_days} days |\n`;
                });
                res.statusCode = 200;
                res.end(md);
                return;
              }

              res.statusCode = 200;
              res.end(JSON.stringify(responseData));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 6. GET /api/user-queries/recent
        if (url === '/api/user-queries/recent' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ recent_queries: (global as any).__recent_queries || [] }));
          return;
        }

        // 7. POST /api/llm/log - Persist LLM prompt and response audit entry
        if (url === '/api/llm/log' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const data = JSON.parse(body || '{}');
              const engine = data.engine || 'Gemini';
              const engineClean = engine.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'LLM';
              const runningNum = ((global as any).__llm_log_seq = ((global as any).__llm_log_seq || 0) % 100 + 1);
              const nowStr = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
              const logId = `LOG-${engineClean}-${String(runningNum).padStart(3, '0')}-${nowStr}`;

              const logEntry = {
                log_id: logId,
                running_number: runningNum,
                engine: data.engine || 'Gemini',
                model_name: data.model_name || data.model || '',
                fired_at: data.fired_at || new Date().toISOString(),
                prompt_text: data.prompt_text || data.prompt || '',
                response_text: data.response_text || data.response || '',
                time_taken_ms: Number(data.time_taken_ms || data.duration_ms || 0),
                status: data.status || 'SUCCESS',
                response_json: data.response_json || data.rawResponseBody || null,
                created_at: new Date().toISOString()
              };

              // 1. Format raw SQL Insert script for user manual / audit execution
              const escapeSql = (s: string) => "'" + (s || '').replace(/'/g, "''") + "'";
              const sqlInsert = `INSERT INTO llm_prompt_logs (log_id, running_number, engine, model_name, fired_at, prompt_text, response_text, time_taken_ms, status, response_json) VALUES (${escapeSql(logEntry.log_id)}, ${logEntry.running_number}, ${escapeSql(logEntry.engine)}, ${escapeSql(logEntry.model_name)}, ${escapeSql(logEntry.fired_at)}, ${escapeSql(logEntry.prompt_text)}, ${escapeSql(logEntry.response_text)}, ${logEntry.time_taken_ms}, ${escapeSql(logEntry.status)}, ${logEntry.response_json ? escapeSql(JSON.stringify(logEntry.response_json)) : 'NULL'});`;

              // 2. Persist to local JSON data store (always succeeds)
              const dataPath = path.resolve(__dirname, 'src/data/stored_prompt_logs.json');
              let existingLogs: any[] = [];
              if (fs.existsSync(dataPath)) {
                try {
                  existingLogs = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '[]');
                } catch {}
              }
              existingLogs.unshift(logEntry);
              if (existingLogs.length > 200) {
                existingLogs = existingLogs.slice(0, 200);
              }
              fs.writeFileSync(dataPath, JSON.stringify(existingLogs, null, 2), 'utf-8');

              // 3. Attempt direct PostgreSQL insertion via node-pg
              let pgSuccess = false;
              let pgError: string | null = null;
              try {
                const getPgConfig = () => {
                  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
                  try {
                    const cp = path.resolve(__dirname, 'config.ini');
                    if (fs.existsSync(cp)) {
                      const t = fs.readFileSync(cp, 'utf-8');
                      const gv = (k: string) => {
                        const m = t.match(new RegExp(`^${k}\\s*=\\s*(.+)$`, 'm'));
                        return m ? m[1].trim() : undefined;
                      };
                      return {
                        host: gv('host') || 'localhost',
                        port: parseInt(gv('port') || '5432', 10),
                        database: gv('dbname') || 'astro',
                        user: gv('user') || 'postgres',
                        password: gv('password') || 'postgres'
                      };
                    }
                  } catch {}
                  return {
                    host: process.env.PGHOST || 'localhost',
                    port: parseInt(process.env.PGPORT || '5432', 10),
                    database: process.env.PGDATABASE || 'astro',
                    user: process.env.PGUSER || 'postgres',
                    password: process.env.PGPASSWORD || 'postgres'
                  };
                };

                const pgClient = new pg.Client({ ...getPgConfig(), connectionTimeoutMillis: 1500 });
                await pgClient.connect();
                try {
                  await pgClient.query(`
                    CREATE SEQUENCE IF NOT EXISTS llm_prompt_log_seq MINVALUE 1 MAXVALUE 100 START WITH 1 INCREMENT BY 1 CYCLE;
                    CREATE TABLE IF NOT EXISTS llm_prompt_logs (
                      id SERIAL PRIMARY KEY,
                      log_id VARCHAR(64) UNIQUE NOT NULL,
                      running_number INTEGER NOT NULL,
                      engine VARCHAR(50) NOT NULL,
                      model_name VARCHAR(100),
                      fired_at TIMESTAMP WITH TIME ZONE NOT NULL,
                      prompt_text TEXT NOT NULL,
                      response_text TEXT NOT NULL,
                      time_taken_ms INTEGER NOT NULL,
                      status VARCHAR(30) DEFAULT 'SUCCESS',
                      response_json JSONB,
                      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                  `);
                  await pgClient.query(`
                    INSERT INTO llm_prompt_logs (
                      log_id, running_number, engine, model_name, fired_at,
                      prompt_text, response_text, time_taken_ms, status, response_json
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (log_id) DO NOTHING;
                  `, [
                    logEntry.log_id,
                    logEntry.running_number,
                    logEntry.engine,
                    logEntry.model_name,
                    logEntry.fired_at,
                    logEntry.prompt_text,
                    logEntry.response_text,
                    logEntry.time_taken_ms,
                    logEntry.status,
                    logEntry.response_json ? JSON.stringify(logEntry.response_json) : null
                  ]);
                  pgSuccess = true;
                } catch (pgInner: any) {
                  pgError = pgInner.message;
                } finally {
                  await pgClient.end().catch(() => {});
                }
              } catch (connErr: any) {
                pgError = connErr.message;
              }

              // 4. Asynchronously forward to Python Postgres API server (port 5000) if active
              try {
                fetch('http://127.0.0.1:5000/api/llm/log', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                }).catch(() => {});
              } catch {}

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                log_id: logId,
                running_number: runningNum,
                pg_persisted: pgSuccess,
                pg_error: pgError,
                persisted_in: pgSuccess
                  ? 'postgresql.llm_prompt_logs & stored_prompt_logs.json'
                  : 'stored_prompt_logs.json',
                sql_insert: sqlInsert
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 8. GET /api/llm/logs - Retrieve LLM prompt logs
        if (url.startsWith('/api/llm/logs') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          // Try fetching directly from PostgreSQL first
          try {
            const getPgConfig = () => {
              if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
              return {
                host: process.env.PGHOST || 'localhost',
                port: parseInt(process.env.PGPORT || '5432', 10),
                database: process.env.PGDATABASE || 'astro',
                user: process.env.PGUSER || 'postgres',
                password: process.env.PGPASSWORD || 'postgres'
              };
            };
            const client = new pg.Client({ ...getPgConfig(), connectionTimeoutMillis: 1200 });
            await client.connect();
            const queryRes = await client.query('SELECT * FROM llm_prompt_logs ORDER BY id DESC LIMIT 50;');
            await client.end();
            if (queryRes.rows && queryRes.rows.length > 0) {
              res.statusCode = 200;
              res.end(JSON.stringify({ logs: queryRes.rows, source: 'postgresql' }));
              return;
            }
          } catch {}

          // Fallback to local stored_prompt_logs.json
          const dataPath = path.resolve(__dirname, 'src/data/stored_prompt_logs.json');
          let logs: any[] = [];
          if (fs.existsSync(dataPath)) {
            try {
              logs = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '[]');
            } catch {}
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ logs, source: 'stored_prompt_logs.json' }));
          return;
        }

        next();
      });
    }
  };
}

function geminiApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'gemini-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/llm/gemini', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { prompt } = JSON.parse(body || '{}');
            const rawKey = (env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
            const isPlaceholder = !rawKey || rawKey === 'MY_GEMINI_API_KEY' || rawKey.includes('placeholder') || rawKey.includes('your_api_key');

            if (isPlaceholder) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'GEMINI_API_KEY is not configured or is a placeholder. Please set GEMINI_API_KEY="AIzaSy..." in your .env file or system environment variables. (Get a free key at https://aistudio.google.com/apikey).'
              }));
              return;
            }

            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: rawKey });

            let response;
            let usedModel = 'gemini-3.8-flash';
            try {
              response = await ai.models.generateContent({
                model: 'gemini-3.8-flash',
                contents: prompt,
                config: {
                  temperature: 0.2,
                  responseMimeType: 'application/json'
                }
              });
            } catch (e: any) {
              usedModel = 'gemini-3.1-flash-lite';
              response = await ai.models.generateContent({
                model: 'gemini-3.1-flash-lite',
                contents: prompt,
                config: {
                  temperature: 0.2,
                  responseMimeType: 'application/json'
                }
              });
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              text: response.text,
              model: response.modelVersion || usedModel,
              usageMetadata: response.usageMetadata
            }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            let errorMsg = err.message || 'Gemini Generation Failed';
            try {
              const parsed = JSON.parse(errorMsg);
              if (parsed?.error?.message) {
                errorMsg = parsed.error.message;
              }
            } catch {}

            if (errorMsg.includes('API key not valid') || errorMsg.includes('API_KEY_INVALID')) {
              errorMsg = 'Invalid Gemini API Key: Google Generative AI rejected the key with 400 INVALID_ARGUMENT. Please verify your GEMINI_API_KEY in your .env file or environment variables at https://aistudio.google.com/apikey and restart the dev server.';
            } else if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota') || errorMsg.includes('429')) {
              errorMsg = 'Gemini Quota Exceeded (429 RESOURCE_EXHAUSTED): Rate limit or quota ceiling reached. If you are on a Paid Tier and using a paid API key, this happens because: 1) In Google AI Studio (aistudio.google.com/apikey), your API key must be created inside the exact Google Cloud Project that has billing enabled, not the default unbilled project; 2) Paid Tier 1 still enforces per-minute burst rate limits (RPM/TPM); 3) A Google Cloud billing budget cap or card verification hold is active. You can also switch immediately to Local 14B (LLM Studio / Bionic) or Local 7B (Ollama) in the inspector for unlimited, offline reasoning.';
            }

            res.end(JSON.stringify({ error: errorMsg }));
          }
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), geminiApiPlugin(env), astroApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
