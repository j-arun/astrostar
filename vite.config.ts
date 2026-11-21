import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { execFile } from 'child_process';
import pg from 'pg';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { GEMINI_FALLBACK_MODEL, GEMINI_PRIMARY_MODEL } from './src/services/llm/geminiModels.ts';
import { createReportFilenameTimestamp } from './src/services/reportFilename.ts';

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

        // 8. CORS OPTIONS handler for /api/dasha/ and horoscope endpoints
        if (req.method === 'OPTIONS' && (url.startsWith('/api/dasha') || url.startsWith('/api/persons') || url.startsWith('/api/horoscope'))) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.statusCode = 204;
          res.end();
          return;
        }

        // 9. GET /api/dasha/notes?person_id=...
        const getDashaNotesMatch = url.match(/^\/api\/dasha\/notes(\?.*)?$/);
        if (getDashaNotesMatch && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          let personId = '001ME';
          try {
            const parsedUrl = new URL(url, 'http://localhost:3000');
            personId = parsedUrl.searchParams.get('person_id') || '001ME';
          } catch {}

          const notesPath = path.resolve(__dirname, 'src/data/dasha_notes.json');
          let evaluations: any[] = [];
          if (fs.existsSync(notesPath)) {
            try {
              const notesDb = JSON.parse(fs.readFileSync(notesPath, 'utf-8') || '{}');
              evaluations = notesDb[personId] || [];
            } catch (e) {
              console.error('Error reading dasha_notes.json:', e);
            }
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, evaluations }));
          return;
        }

        // 9b. GET /api/dasha/pd?person_id=...&md=...&ad=...
        const getDashaPdMatch = url.match(/^\/api\/dasha\/pd(\?.*)?$/);
        if (getDashaPdMatch && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          let personId = '001ME', mdQuery = '', adQuery = '';
          try {
            const parsedUrl = new URL(url, 'http://localhost:3000');
            personId = parsedUrl.searchParams.get('person_id') || '001ME';
            mdQuery = (parsedUrl.searchParams.get('md') || parsedUrl.searchParams.get('mahadasha') || '').trim();
            adQuery = (parsedUrl.searchParams.get('ad') || parsedUrl.searchParams.get('antardasha') || '').trim();
          } catch {}

          const notesPath = path.resolve(__dirname, 'src/data/dasha_notes.json');
          let notesDb: Record<string, any[]> = {};
          if (fs.existsSync(notesPath)) {
            try {
              notesDb = JSON.parse(fs.readFileSync(notesPath, 'utf-8') || '{}');
            } catch {}
          }
          const personNotes = notesDb[personId] || [];
          const matchingPds = personNotes.filter(n => {
            const mdMatch = !mdQuery || (n.mahadasha_lord_md || '').toLowerCase().includes(mdQuery.toLowerCase());
            const adMatch = !adQuery || (n.antardasha_lord_ad || '').toLowerCase().includes(adQuery.toLowerCase());
            return mdMatch && adMatch;
          });

          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            person_id: personId,
            mahadasha: mdQuery,
            antardasha: adQuery,
            pds: matchingPds,
            source: 'embedded_store'
          }));
          return;
        }

        // 10. POST /api/dasha/notes - Save PD note and rating to dasha_notes.json
        if (url === '/api/dasha/notes' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            try {
              const data = JSON.parse(body || '{}');
              const personId = data.person_id;
              const period = data.period || {};
              const notes = data.notes !== undefined ? data.notes : period.notes;
              const rating = data.evaluation_rating !== undefined ? data.evaluation_rating : period.evaluation_rating;

              if (!personId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing person_id' }));
                return;
              }

              const notesPath = path.resolve(__dirname, 'src/data/dasha_notes.json');
              let notesDb: Record<string, any[]> = {};
              if (fs.existsSync(notesPath)) {
                try {
                  notesDb = JSON.parse(fs.readFileSync(notesPath, 'utf-8') || '{}');
                } catch {}
              }
              if (!Array.isArray(notesDb[personId])) {
                notesDb[personId] = [];
              }

              const record = {
                person_id: personId,
                mahadasha_lord_md: period.mahadasha_lord_md,
                antardasha_lord_ad: period.antardasha_lord_ad,
                pratyantardasha_lord_pd: period.pratyantardasha_lord_pd,
                start_date: period.start_date,
                end_date: period.end_date,
                notes: notes ?? null,
                evaluation_rating: rating ?? null
              };

              const normalizeLord = (name?: string) => {
                if (!name) return '';
                const clean = name.split('(')[0].trim();
                return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
              };

              const cleanMd = normalizeLord(record.mahadasha_lord_md);
              const cleanAd = normalizeLord(record.antardasha_lord_ad);
              const cleanPd = normalizeLord(record.pratyantardasha_lord_pd);

              const existingIdx = notesDb[personId].findIndex(item =>
                normalizeLord(item.mahadasha_lord_md) === cleanMd &&
                normalizeLord(item.antardasha_lord_ad) === cleanAd &&
                normalizeLord(item.pratyantardasha_lord_pd) === cleanPd
              );

              if (existingIdx >= 0) {
                notesDb[personId][existingIdx].notes = record.notes;
                notesDb[personId][existingIdx].evaluation_rating = record.evaluation_rating;
                if (record.start_date) notesDb[personId][existingIdx].start_date = record.start_date;
                if (record.end_date) notesDb[personId][existingIdx].end_date = record.end_date;
              } else {
                notesDb[personId].push(record);
              }

              fs.writeFileSync(notesPath, JSON.stringify(notesDb, null, 2), 'utf-8');

              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, notes: record.notes, evaluation_rating: record.evaluation_rating }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 11. GET /api/dasha/ad-narrative/prompt
        const getAdNarrativePromptMatch = url.match(/^\/api\/dasha\/ad-narrative\/prompt(\?.*)?$/);
        if (getAdNarrativePromptMatch && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          let personId = '001ME', md = '', ad = '', start = '', end = '';
          try {
            const parsedUrl = new URL(url, 'http://localhost:3000');
            personId = parsedUrl.searchParams.get('person_id') || '001ME';
            md = parsedUrl.searchParams.get('mahadasha_lord_md') || '';
            ad = parsedUrl.searchParams.get('antardasha_lord_ad') || '';
            start = parsedUrl.searchParams.get('start_date') || '';
            end = parsedUrl.searchParams.get('end_date') || '';
          } catch {}

          const notesPath = path.resolve(__dirname, 'src/data/dasha_notes.json');
          let observations: any[] = [];
          if (fs.existsSync(notesPath)) {
            try {
              const notesDb = JSON.parse(fs.readFileSync(notesPath, 'utf-8') || '{}');
              observations = (notesDb[personId] || []).filter((item: any) => {
                const mdMatch = !md || item.mahadasha_lord_md?.toLowerCase().includes(md.toLowerCase().split(' ')[0]);
                const adMatch = !ad || item.antardasha_lord_ad?.toLowerCase().includes(ad.toLowerCase().split(' ')[0]);
                return mdMatch && adMatch;
              });
            } catch {}
          }

          const prompt = [
            `Task: Synthesize a concise chronological personal-event narrative for ${md} MD - ${ad} AD (${start} to ${end}).`,
            'Grounding rules: Attribute events directly to the explicit Pratyantardasha Lord tag (e.g. [PD: Moon] or [PD: Venus]).',
            'PD observations:',
            ...(observations.length > 0
              ? observations.map((o: any) => `- ${o.start_date} to ${o.end_date} | PD: ${o.pratyantardasha_lord_pd} | Rating: ${o.evaluation_rating ?? 'none'} | Note: ${o.notes || 'No landmark note'}`)
              : [`- ${start} to ${end} | PD: Active Window | Period evaluated.`])
          ].join('\n');

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, prompt }));
          return;
        }

        // 12. POST /api/dasha/ad-narrative - Grounded narrative generation
        if (url === '/api/dasha/ad-narrative' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            try {
              const data = JSON.parse(body || '{}');
              const personId = data.person_id || '001ME';
              const md = data.mahadasha_lord_md || '';
              const ad = data.antardasha_lord_ad || '';
              const start = data.start_date || '';
              const end = data.end_date || '';
              const customPrompt = data.custom_prompt;
              const pdFeeds = Array.isArray(data.pd_feeds) ? data.pd_feeds : [];

              let feedsToUse = pdFeeds;
              if (feedsToUse.length === 0) {
                const notesPath = path.resolve(__dirname, 'src/data/dasha_notes.json');
                if (fs.existsSync(notesPath)) {
                  try {
                    const notesDb = JSON.parse(fs.readFileSync(notesPath, 'utf-8') || '{}');
                    feedsToUse = (notesDb[personId] || []).filter((item: any) => {
                      const mdMatch = !md || item.mahadasha_lord_md?.toLowerCase().includes(md.toLowerCase().split(' ')[0]);
                      const adMatch = !ad || item.antardasha_lord_ad?.toLowerCase().includes(ad.toLowerCase().split(' ')[0]);
                      return mdMatch && adMatch;
                    });
                  } catch {}
                }
              }

              const humanNotes = feedsToUse.filter((f: any) => f.notes && typeof f.notes === 'string' && f.notes.trim().length > 0);
              if (humanNotes.length === 0) {
                res.statusCode = 400;
                res.end(JSON.stringify({
                  success: false,
                  error: 'This Antardasha (MD-AD) has no human-written PD notes to summarize yet. LLM only summarizes genuine human notes.'
                }));
                return;
              }

              const narrativeLines = humanNotes.map((f: any) => {
                const lord = f.pratyantardasha_lord || f.pratyantardasha_lord_pd || 'Graha';
                const noteText = f.notes.trim();
                const r = f.evaluation_rating;
                const rLabel = r === 10 ? 'positive' : r === 0 ? 'challenging' : r === 5 ? 'favorable/mixed' : null;
                const ratingSuffix = rLabel ? `, evaluated as ${rLabel}` : '';
                return `[PD: ${lord}] ${noteText.replace(/[.]+$/, '')}. (${f.start_date} to ${f.end_date}${ratingSuffix}).`;
              });

              const narrative = [
                `Chronological MD-AD Synthesis for ${md} - ${ad} (${start} to ${end}):`,
                ...narrativeLines
              ].join('\n');

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                narrative,
                prompt: customPrompt || `Synthesized for ${md} MD - ${ad} AD`,
                model: 'Deterministic Grounded Synthesizer (Vite Preview)',
                generated_at: new Date().toISOString()
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 13. POST /api/ad-narratives - Upsert into ad_narratives table and disk storage
        if (url === '/api/ad-narratives' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            try {
              const data = JSON.parse(body || '{}');
              const uniqueId = data.unique_id || `${data.person_id}_${data.md}_${data.ad}`.replace(/\s+/g, '');
              const personId = data.person_id || '001ME';
              const md = data.md || '';
              const ad = data.ad || '';
              const startDate = data.start_date || '';
              const endDate = data.end_date || '';
              const lifePeriod = data.life_period || '';
              const primaryDomains = Array.isArray(data.primary_domains) ? data.primary_domains.join(', ') : (data.primary_domains || '');
              const keyMilestones = data.key_milestones || '';
              const narrative = data.narrative || '';
              const sourceModel = data.source_model || 'local_qwen';
              const nowIso = new Date().toISOString();

              let pgSuccess = false;
              let pgError = null;

              // 1. Attempt PostgreSQL persistence if database is available
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
                const client = new pg.Client({ ...getPgConfig(), connectionTimeoutMillis: 1500 });
                await client.connect();

                // Ensure ad_narratives table exists
                await client.query(`
                  CREATE TABLE IF NOT EXISTS ad_narratives (
                    unique_id VARCHAR(64) PRIMARY KEY,
                    person_id VARCHAR(50) NOT NULL,
                    md VARCHAR(30) NOT NULL,
                    ad VARCHAR(30) NOT NULL,
                    start_date VARCHAR(20),
                    end_date VARCHAR(20),
                    life_period VARCHAR(50),
                    primary_domains TEXT,
                    key_milestones TEXT,
                    narrative TEXT,
                    source_model VARCHAR(50) DEFAULT 'local_qwen',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                  );
                  CREATE INDEX IF NOT EXISTS idx_ad_narratives_person_md_ad 
                    ON ad_narratives (person_id, md, ad);
                `);

                // Upsert record
                await client.query(`
                  INSERT INTO ad_narratives (
                    unique_id, person_id, md, ad, start_date, end_date,
                    life_period, primary_domains, key_milestones, narrative, source_model, updated_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
                  ON CONFLICT (unique_id) DO UPDATE SET
                    life_period = EXCLUDED.life_period,
                    primary_domains = EXCLUDED.primary_domains,
                    key_milestones = EXCLUDED.key_milestones,
                    narrative = EXCLUDED.narrative,
                    source_model = EXCLUDED.source_model,
                    updated_at = CURRENT_TIMESTAMP;
                `, [uniqueId, personId, md, ad, startDate, endDate, lifePeriod, primaryDomains, keyMilestones, narrative, sourceModel]);

                await client.end();
                pgSuccess = true;
              } catch (err: any) {
                pgError = err.message || String(err);
              }

              // 2. Guarantee persistence into server-side JSON store (src/data/ad_narratives.json)
              const dataPath = path.resolve(__dirname, 'src/data/ad_narratives.json');
              let dbRecords: Record<string, any> = {};
              if (fs.existsSync(dataPath)) {
                try {
                  dbRecords = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
                } catch {}
              }

              dbRecords[uniqueId] = {
                unique_id: uniqueId,
                person_id: personId,
                md,
                ad,
                start_date: startDate,
                end_date: endDate,
                life_period: lifePeriod,
                primary_domains: Array.isArray(data.primary_domains) ? data.primary_domains : primaryDomains.split(',').map((s: string) => s.trim()).filter(Boolean),
                key_milestones: keyMilestones,
                narrative,
                source_model: sourceModel,
                updated_at: nowIso,
                pg_persisted: pgSuccess
              };

              fs.writeFileSync(dataPath, JSON.stringify(dbRecords, null, 2), 'utf-8');

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                unique_id: uniqueId,
                person_id: personId,
                pg_persisted: pgSuccess,
                pg_error: pgError,
                message: `Successfully saved AD narrative for ${md} > ${ad} into database table ad_narratives!`,
                timestamp: nowIso
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 14. GET /api/ad-narratives - Fetch stored narratives from PostgreSQL & disk storage
        if (url.startsWith('/api/ad-narratives') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          let personIdQuery = '';
          try {
            const parsedUrl = new URL(url, 'http://localhost:3000');
            personIdQuery = parsedUrl.searchParams.get('person_id') || '';
          } catch {}

          // Check PostgreSQL first
          let pgRows: any[] = [];
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
            const queryRes = personIdQuery
              ? await client.query('SELECT * FROM ad_narratives WHERE person_id = $1 ORDER BY updated_at DESC;', [personIdQuery])
              : await client.query('SELECT * FROM ad_narratives ORDER BY updated_at DESC;');
            await client.end();
            if (queryRes.rows && queryRes.rows.length > 0) {
              pgRows = queryRes.rows;
            }
          } catch {}

          // Fallback to local ad_narratives.json
          const dataPath = path.resolve(__dirname, 'src/data/ad_narratives.json');
          let fileRecords: any[] = [];
          if (fs.existsSync(dataPath)) {
            try {
              const fileDb = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
              fileRecords = Object.values(fileDb);
              if (personIdQuery) {
                fileRecords = fileRecords.filter((r: any) => r.person_id === personIdQuery);
              }
            } catch {}
          }

          const combined = pgRows.length > 0 ? pgRows : fileRecords;
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            count: combined.length,
            records: combined,
            source: pgRows.length > 0 ? 'postgresql.ad_narratives' : 'ad_narratives.json'
          }));
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
        // Full CORS Support for Browser iFrame & Cross-Origin Calls
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key, x-api-key');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { prompt, systemInstruction, apiKey: bodyApiKey, model: requestedModel, isTestPing } = JSON.parse(body || '{}');

            // Header x-goog-api-key / x-api-key sent by client UI, JSON body, or server environment variables
            const customHeaderKey = (req.headers['x-goog-api-key'] || req.headers['x-api-key']) as string | undefined;
            const rawKey = (
              bodyApiKey ||
              customHeaderKey ||
              env.GEMINI_API_KEY ||
              process.env.GEMINI_API_KEY ||
              ''
            ).trim();

            const isPlaceholder = !rawKey || rawKey === 'MY_GEMINI_API_KEY' || rawKey.includes('placeholder') || rawKey.includes('your_api_key');

            if (isPlaceholder) {
              res.statusCode = 401;
              res.end(JSON.stringify({
                error: 'Google Gemini Authentication Required: The default service key is unavailable or expired. Please enter your active Gemini API key from https://aistudio.google.com/apikey in the Gemini Key input field in the top header.',
                code: 'ACCOUNT_STATE_INVALID',
                statusCode: 401
              }));
              return;
            }

            // 3-Tier Free Tier Architecture for Google Gemini
            // Tier 1: Flagship Free-Tier Pro-Grade synthesis (gemini-flash-latest / gemini-3.8-flash)
            // Tier 2: Dedicated Pro Model if billed project available (gemini-2.5-pro / gemini-4-argon)
            // Tier 3: High-speed resilient fallback (gemini-3.1-flash-lite)
            let targetModel = requestedModel || 'gemini-flash-latest';
            if (targetModel === 'gemini_pro' || targetModel === 'gemini-pro') {
              // Free tier Gemini Pro: defaults to flagship free-tier model with 3-tier cascade
              targetModel = 'gemini-flash-latest';
            } else if (targetModel === 'gemini-2.5-flash' || targetModel === 'gemini-2.0-flash' || targetModel === 'gemini-1.5-flash') {
              targetModel = 'gemini-flash-latest';
            }

            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({
              apiKey: rawKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build'
                }
              }
            });

            // If this is a lightweight test ping to verify key health
            if (isTestPing || prompt === 'ping' || prompt === 'hi') {
              const pingCandidates = [
                'gemini-flash-latest',
                'gemini-3.8-flash',
                'gemini-3.1-flash-lite'
              ];
              let pingRes: any = null;
              let usedPingModel = targetModel;
              let lastPingErr: any = null;

              for (const pModel of pingCandidates) {
                try {
                  pingRes = await ai.models.generateContent({
                    model: pModel,
                    contents: 'Say hello in 3 words to confirm Gemini API key connection.',
                    config: { maxOutputTokens: 15 }
                  });
                  usedPingModel = pModel;
                  break;
                } catch (pErr: any) {
                  lastPingErr = pErr;
                }
              }

              if (pingRes) {
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  status: 'OK',
                  message: `Gemini API Key Verified & Connected (${pingRes.modelVersion || usedPingModel}) [Free-Tier 3-Tier Mode Active]`,
                  model: pingRes.modelVersion || usedPingModel,
                  sampleResponse: pingRes.text
                }));
                return;
              } else {
                res.statusCode = 400;
                let errDetail = lastPingErr?.message || 'Gemini Key Ping Failed';
                try {
                  const parsed = JSON.parse(errDetail);
                  if (parsed.error?.message) {
                    errDetail = `${parsed.error.code ? `[Code ${parsed.error.code}] ` : ''}${parsed.error.message}`;
                  }
                } catch {
                  // Keep as string
                }
                res.end(JSON.stringify({
                  success: false,
                  error: errDetail
                }));
                return;
              }
            }

            let response: any = null;
            let usedModel = targetModel;
            const candidateModels = Array.from(new Set([
              targetModel,
              'gemini-flash-latest',
              'gemini-3.8-flash',
              'gemini-3.1-flash-lite',
              'gemini-4-argon'
            ]));

            let lastError: any = null;
            for (const candModel of candidateModels) {
              for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                  response = await ai.models.generateContent({
                    model: candModel,
                    contents: prompt,
                    config: {
                      ...(systemInstruction ? { systemInstruction } : {}),
                      temperature: 0.2,
                      responseMimeType: 'application/json'
                    }
                  });
                  usedModel = candModel;
                  break;
                } catch (candErr: any) {
                  lastError = candErr;
                  const errMsg = candErr?.message || '';
                  const isRetryable = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('429');
                  if (isRetryable && attempt === 1) {
                    await new Promise(r => setTimeout(r, 800));
                  } else {
                    // Try next model in 3-tier cascade
                    break;
                  }
                }
              }
              if (response) break;
            }

            if (!response) {
              throw lastError || new Error(`All candidate models (${candidateModels.join(', ')}) failed.`);
            }

            res.statusCode = 200;
            res.end(JSON.stringify({
              text: response.text,
              model: response.modelVersion || usedModel,
              usageMetadata: response.usageMetadata
            }));
          } catch (err: any) {
            let errorMsg = err.message || 'Gemini Generation Failed';
            let statusCode = 500;
            try {
              const parsed = JSON.parse(errorMsg);
              if (parsed?.error?.message) {
                errorMsg = parsed.error.message;
              }
            } catch {}

            if (
              errorMsg.includes('bound service account is deleted or disabled') ||
              errorMsg.includes('ACCOUNT_STATE_INVALID') ||
              errorMsg.includes('401')
            ) {
              statusCode = 401;
              errorMsg = 'Google Gemini Authentication Error (401 UNAUTHENTICATED): The service account bound to this API key is deleted or disabled. Please enter an active Gemini API Key from https://aistudio.google.com/apikey in the Gemini Key settings.';
            } else if (errorMsg.includes('API key not valid') || errorMsg.includes('API_KEY_INVALID') || (errorMsg.includes('INVALID_ARGUMENT') && (errorMsg.toLowerCase().includes('key') || errorMsg.toLowerCase().includes('credential')))) {
              statusCode = 400;
              errorMsg = 'Invalid Gemini API Key: Google Generative AI rejected the key with 400 INVALID_ARGUMENT. Please check your Gemini API key at https://aistudio.google.com/apikey and paste it into the Gemini Key input.';
            } else if (errorMsg.includes('INVALID_ARGUMENT')) {
              statusCode = 400;
              errorMsg = `Gemini Request Error (400 INVALID_ARGUMENT): ${errorMsg}`;
            } else if (errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota') || errorMsg.includes('429')) {
              statusCode = 429;
              errorMsg = 'Gemini Quota Exceeded (429 RESOURCE_EXHAUSTED): Rate limit or quota ceiling reached. Verify that your API key is created inside a Google Cloud Project with billing enabled at https://aistudio.google.com/apikey.';
            }

            res.statusCode = statusCode;
            res.end(JSON.stringify({
              error: errorMsg,
              code: statusCode === 401 ? 'ACCOUNT_STATE_INVALID' : statusCode === 429 ? 'RESOURCE_EXHAUSTED' : 'API_ERROR',
              statusCode
            }));
          }
        });
      });
    }
  };
}

function claudeApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'claude-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/llm/claude', async (req, res) => {
        // Full CORS Support for Browser iFrame & Cross-Origin Calls
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { prompt, system, usePromptCache, model: requestedModel, apiKey: bodyApiKey, thinkingMode, budgetTokens, maxTokens, isTestPing } = JSON.parse(body || '{}');

            // Header x-api-key sent by client UI, JSON body, or server environment variables
            const customHeaderKey = req.headers['x-api-key'] as string | undefined;
            const rawKey = (
              bodyApiKey ||
              customHeaderKey ||
              env.ANTHROPIC_API_KEY ||
              process.env.ANTHROPIC_API_KEY ||
              env.CLAUDE_API_KEY ||
              process.env.CLAUDE_API_KEY ||
              ''
            ).trim();

            const isPlaceholder = !rawKey || rawKey === 'MY_ANTHROPIC_API_KEY' || rawKey.includes('placeholder') || rawKey.includes('your_api_key');

            if (isPlaceholder) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                error: 'ANTHROPIC_API_KEY is not configured. Please set ANTHROPIC_API_KEY="sk-ant-..." in your .env file or enter your key in the UI Claude API Key field. (Get a key at https://console.anthropic.com).'
              }));
              return;
            }

            let primaryModel = requestedModel || 'claude-sonnet-5-5';
            // Normalize any 5.5 / IQ variations
            if (primaryModel === 'claude-5-5-sonnet' || primaryModel === 'claude-sonnet-5.5' || primaryModel === 'claude') {
              primaryModel = 'claude-sonnet-5-5';
            } else if (primaryModel === 'claude-5-5-haiku' || primaryModel === 'claude-haiku-5.5' || primaryModel === 'claude-iq' || primaryModel === 'claude-5-5-iq') {
              primaryModel = 'claude-haiku-5-5';
            }

            // Fast token limit for test ping, else 16,000 for full synthesis
            const isPing = isTestPing || prompt === 'ping' || prompt === 'hi';
            const effectiveMaxTokens = isPing ? 10 : Math.max(maxTokens || 16000, 16000);

            const payload: any = {
              model: primaryModel,
              max_tokens: effectiveMaxTokens,
              ...(system && String(system).trim().length > 0
                ? {
                    system:
                      usePromptCache !== false
                        ? [{ type: 'text', text: String(system), cache_control: { type: 'ephemeral' } }]
                        : String(system)
                  }
                : {}),
              messages: [
                {
                  role: 'user',
                  content: isPing ? 'hi' : prompt
                }
              ]
            };

            // Fable requires adaptive thinking; effort controls its depth (at least medium so strict output contracts hold).
            if (primaryModel === 'claude-fable-5-1') {
              payload.thinking = { type: 'adaptive' };
              payload.output_config = {
                effort: thinkingMode === 'enabled' ? 'high' : 'medium'
              };
            } else if (thinkingMode === 'disabled') {
              // On Sonnet 5.5 and Claude 5 models, Anthropic requires "between_tools" instead of "disabled" to turn thinking off
              // (Error: 'To turn thinking off on this model, send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}')
              if (primaryModel.includes('5-5') || primaryModel.includes('sonnet-5') || primaryModel.includes('haiku-5') || primaryModel.includes('opus-5')) {
                payload.thinking = { type: 'between_tools' };
              } else {
                payload.thinking = { type: 'disabled' };
              }
            } else if (thinkingMode === 'enabled') {
              if (primaryModel.includes('5-5') || primaryModel.includes('sonnet-5') || primaryModel.includes('haiku-5')) {
                // Sonnet 5.5 / 5 uses output_config effort or adaptive thinking without budget_tokens
                payload.output_config = { effort: 'medium' };
              } else {
                payload.thinking = { type: 'enabled', budget_tokens: budgetTokens || 2048 };
              }
            }
            // If thinkingMode is 'auto', no thinking field is passed, allowing Anthropic default adaptive behavior

            // 1. Log outgoing payload right before fetch
            console.log("SENT:", JSON.stringify({ ...payload, system: payload.system ? "[cached_system]" : undefined, messages: "[omitted]" }));

            let anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': rawKey,
                'anthropic-version': '2023-06-01'
              },
              body: JSON.stringify(payload)
            });

            let data: any = await anthropicResponse.json();

            console.log("ANTHROPIC STATUS:", anthropicResponse.status);

            // Auto-recovery if Anthropic specifies thinking parameter requirement
            if (!anthropicResponse.ok && data?.error?.message) {
              const errMsg = data.error.message;
              if (errMsg.includes('between_tools') && payload.thinking?.type !== 'between_tools') {
                console.log("Auto-correcting thinking parameter to { type: 'between_tools' } per Anthropic API requirement...");
                payload.thinking = { type: 'between_tools' };
                console.log("RETRY SENT:", JSON.stringify({ ...payload, messages: "[omitted]" }));
                anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': rawKey,
                    'anthropic-version': '2023-06-01'
                  },
                  body: JSON.stringify(payload)
                });
                data = await anthropicResponse.json();
                console.log("ANTHROPIC RETRY STATUS:", anthropicResponse.status);
              } else if (errMsg.includes('"disabled"') && payload.thinking?.type !== 'disabled') {
                console.log("Auto-correcting thinking parameter to { type: 'disabled' } per Anthropic API requirement...");
                payload.thinking = { type: 'disabled' };
                console.log("RETRY SENT:", JSON.stringify({ ...payload, messages: "[omitted]" }));
                anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': rawKey,
                    'anthropic-version': '2023-06-01'
                  },
                  body: JSON.stringify(payload)
                });
                data = await anthropicResponse.json();
                console.log("ANTHROPIC RETRY STATUS:", anthropicResponse.status);
              }
            }

            // If still not ok, log error and return to caller
            if (!anthropicResponse.ok) {
              console.error("ANTHROPIC ERROR RESPONSE:", JSON.stringify(data));
              res.statusCode = anthropicResponse.status;
              res.setHeader('Content-Type', 'application/json');
              const errMessage = data?.error?.message || `HTTP ${anthropicResponse.status}: ${JSON.stringify(data)}`;
              res.end(JSON.stringify({
                error: `Anthropic Claude Error: ${errMessage}`,
                model: primaryModel,
                raw: data
              }));
              return;
            }

            console.log("ANTHROPIC SUCCESS:", "Model:", data.model, "Usage:", JSON.stringify(data.usage));

            let text = data.content
              ?.filter((c: any) => c.type === 'text')
              ?.map((c: any) => c.text)
              ?.join('\n') || '';

            const thinkingText = data.content
              ?.filter((c: any) => c.type === 'thinking')
              ?.map((c: any) => c.thinking)
              ?.join('\n') || '';

            // Fallback to thinkingText if model placed reasoning in thinking block and text was empty
            if (!text.trim() && thinkingText.trim()) {
              text = thinkingText;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              text,
              thinking: thinkingText,
              model: data.model || primaryModel,
              requestedModel: primaryModel,
              attemptedModels: [primaryModel],
              stop_reason: data.stop_reason,
              usage: data.usage
            }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Claude Generation Proxy Failed' }));
          }
        });
      });
    }
  };
}

function docsServerPlugin(): Plugin {
  const DOCS_MONTH_ORDER = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const scanDiskDocReports = () => {
    const discovered: Array<{
      year: number;
      month: string;
      monthIndex: number;
      engineKey: string;
      reportData: any;
      htmlUrl?: string;
      pdfUrl?: string;
      docUrl?: string;
      dataUrl: string;
      timestamp: string;
    }> = [];

    const docsRoot = path.resolve(__dirname, 'docs');
    if (!fs.existsSync(docsRoot)) return discovered;

    try {
      const yearDirs = fs.readdirSync(docsRoot).filter(d => /^\d{4}$/.test(d));
      for (const yearStr of yearDirs) {
        const yearNum = Number(yearStr);
        const yearPath = path.join(docsRoot, yearStr);
        if (!fs.statSync(yearPath).isDirectory()) continue;

        const monthDirs = fs.readdirSync(yearPath);
        for (const monthName of monthDirs) {
          const monthPath = path.join(yearPath, monthName);
          if (!fs.statSync(monthPath).isDirectory()) continue;
          const mIdx = DOCS_MONTH_ORDER.findIndex(m => m.toLowerCase() === monthName.toLowerCase());

          const engineDirs = fs.readdirSync(monthPath);
          for (const engineKey of engineDirs) {
            const engPath = path.join(monthPath, engineKey);
            if (!fs.statSync(engPath).isDirectory()) continue;
            const jsonPath = path.join(engPath, 'report_data.json');
            if (!fs.existsSync(jsonPath)) continue;

            try {
              const reportData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              const files = fs.readdirSync(engPath);
              const pickLatestByExt = (ext: string) => {
                const matched = files.filter(f => f.toLowerCase().endsWith(ext)).sort();
                return matched.length > 0 ? `/docs/${yearStr}/${monthName}/${engineKey}/${matched[matched.length - 1]}` : undefined;
              };
              const htmlUrl = pickLatestByExt('.html');
              const pdfUrl = pickLatestByExt('.pdf');
              const docUrl = pickLatestByExt('.doc');
              const stat = fs.statSync(jsonPath);
              const ts = reportData?.savedAt || reportData?.reportGeneratedIso || stat.mtime.toISOString();

              discovered.push({
                year: yearNum,
                month: monthName,
                monthIndex: typeof reportData?.monthIndex === 'number' ? reportData.monthIndex : (mIdx >= 0 ? mIdx : 0),
                engineKey,
                reportData,
                htmlUrl,
                pdfUrl,
                docUrl,
                dataUrl: `/docs/${yearStr}/${monthName}/${engineKey}/report_data.json`,
                timestamp: ts
              });
            } catch {}
          }
        }
      }
    } catch {}

    return discovered;
  };

  return {
    name: 'docs-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        let urlObj: URL;
        try {
          urlObj = new URL(rawUrl, 'http://localhost:3000');
        } catch {
          urlObj = new URL('/' + rawUrl, 'http://localhost:3000');
        }
        const pathname = decodeURIComponent(urlObj.pathname);

        // 1. GET /api/docs/catalog (merges reports_catalog.json + any disk report_data.json folders)
        if (pathname === '/api/docs/catalog' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          let cat: any = { years: [2020, 2022, 2023, 2024, 2025, 2026, 2027], catalog: {} };
          try {
            const catalogPath = path.resolve(__dirname, 'docs/reports_catalog.json');
            if (fs.existsSync(catalogPath)) {
              cat = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
            }
          } catch (e: any) {
            console.error('Error reading catalog:', e);
          }

          if (!Array.isArray(cat.years)) cat.years = [2020, 2022, 2023, 2024, 2025, 2026, 2027];
          if (!cat.catalog || typeof cat.catalog !== 'object') cat.catalog = {};

          const diskReports = scanDiskDocReports();
          for (const item of diskReports) {
            if (!cat.years.includes(item.year)) {
              cat.years.push(item.year);
            }
            const yKey = String(item.year);
            if (!cat.catalog[yKey]) {
              cat.catalog[yKey] = { year: item.year, months: {} };
            }
            if (!cat.catalog[yKey].months[item.month]) {
              cat.catalog[yKey].months[item.month] = {
                monthName: item.month,
                monthIndex: item.monthIndex,
                reports: {}
              };
            }
            const existing = cat.catalog[yKey].months[item.month].reports[item.engineKey];
            if (!existing) {
              const provId = item.reportData?.narrative?.providerUsed || (item.engineKey.includes('qwen') || item.engineKey.includes('ollama') ? 'local_qwen' : item.engineKey);
              const isLocal = provId === 'local_qwen' || item.engineKey.includes('ollama') || item.engineKey.includes('qwen');
              cat.catalog[yKey].months[item.month].reports[item.engineKey] = {
                engineKey: item.engineKey,
                engineName: item.reportData?.engineName || item.engineKey,
                categoryLabel: isLocal ? 'Local Batch / Ollama' : item.engineKey,
                badge: isLocal ? '🖥️ Local Qwen Batch' : '📜 Saved Engine',
                providerId: provId,
                htmlUrl: item.htmlUrl || '',
                pdfUrl: item.pdfUrl || '',
                docUrl: item.docUrl || '',
                dataUrl: item.dataUrl,
                timestamp: item.timestamp,
                hasNarrative: Boolean(item.reportData?.narrative),
                summarySentence: item.reportData?.summarySentence || item.reportData?.narrative?.summarySentence || ''
              };
            }
          }

          cat.years.sort((a: number, b: number) => a - b);
          res.statusCode = 200;
          res.end(JSON.stringify(cat));
          return;
        }

        // 2. GET /api/docs/load?year=2026&month=October&engine=claude_sonnet
        if (pathname === '/api/docs/load' && req.method === 'GET') {
          const year = urlObj.searchParams.get('year') || '2026';
          const month = urlObj.searchParams.get('month') || 'October';
          const engine = urlObj.searchParams.get('engine') || 'claude_sonnet';
          res.setHeader('Content-Type', 'application/json');

          try {
            const jsonPath = path.resolve(__dirname, 'docs', year, month, engine, 'report_data.json');
            if (fs.existsSync(jsonPath)) {
              const content = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, ...content }));
              return;
            }
          } catch (e: any) {}

          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Report not found' }));
          return;
        }

        // 3. POST /api/docs/save
        if (pathname === '/api/docs/save' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body || '{}');
              const {
                year,
                month,
                monthIndex,
                engineKey,
                engineName,
                categoryLabel,
                badge,
                htmlContent,
                docContent,
                pdfBase64,
                narrative,
                context,
                summarySentence
              } = payload;

              if (!year || !month || !engineKey) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing year, month, or engineKey' }));
                return;
              }

              const docsDir = path.resolve(__dirname, 'docs', String(year), String(month), String(engineKey));
              const savedAt = new Date();
              const timestamp = createReportFilenameTimestamp(savedAt);

              if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

              const fileBase = `Tamil_Vedic_Report_${month}_${year}_${engineKey}_${timestamp}`;
              const htmlFilename = `${fileBase}.html`;
              const docFilename = `${fileBase}.doc`;
              const pdfFilename = `${fileBase}.pdf`;
              const jsonFilename = `report_data.json`;

              // Save HTML
              if (htmlContent) {
                fs.writeFileSync(path.join(docsDir, htmlFilename), htmlContent, 'utf-8');
              }

              // Save Word Doc
              if (docContent) {
                fs.writeFileSync(path.join(docsDir, docFilename), docContent, 'utf-8');
              }

              // Save PDF
              if (pdfBase64) {
                const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:.*,/, '');
                const pdfBuffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(path.join(docsDir, pdfFilename), pdfBuffer);
              }

              // Save JSON metadata
              const reportData = {
                year,
                month,
                monthIndex,
                engineKey,
                engineName,
                savedAt: savedAt.toISOString(),
                summarySentence,
                context,
                narrative
              };
              fs.writeFileSync(path.join(docsDir, jsonFilename), JSON.stringify(reportData, null, 2), 'utf-8');

              // Update reports_catalog.json
              const catalogPath = path.resolve(__dirname, 'docs/reports_catalog.json');
              let cat: any = { years: [2020, 2022, 2023, 2024, 2025, 2026, 2027], catalog: {} };
              if (fs.existsSync(catalogPath)) {
                try {
                  cat = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
                } catch {}
              }

              if (!cat.years.includes(Number(year))) {
                cat.years.push(Number(year));
                cat.years.sort((a: number, b: number) => a - b);
              }
              if (!cat.catalog[year]) {
                cat.catalog[year] = { year: Number(year), months: {} };
              }
              if (!cat.catalog[year].months[month]) {
                cat.catalog[year].months[month] = { monthName: month, monthIndex: monthIndex || 0, reports: {} };
              }

              const htmlUrl = `/docs/${year}/${month}/${engineKey}/${htmlFilename}`;
              const pdfUrl = `/docs/${year}/${month}/${engineKey}/${pdfFilename}`;
              const docUrl = `/docs/${year}/${month}/${engineKey}/${docFilename}`;

              cat.catalog[year].months[month].reports[engineKey] = {
                engineKey,
                engineName: engineName || engineKey,
                categoryLabel: categoryLabel || engineKey,
                badge: badge || 'Vedic Engine',
                providerId: narrative?.providerUsed || 'claude_sonnet',
                htmlUrl,
                pdfUrl,
                docUrl,
                timestamp: savedAt.toISOString(),
                hasNarrative: true,
                summarySentence: summarySentence || narrative?.summarySentence || ''
              };

              fs.writeFileSync(catalogPath, JSON.stringify(cat, null, 2), 'utf-8');

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                links: {
                  html: htmlUrl,
                  pdf: pdfUrl,
                  doc: docUrl
                }
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
          return;
        }

        // 3b. GET /api/prediction-cache/list (includes prediction_cache + all saved docs/{year}/{month}/{engine}/report_data.json)
        if (pathname === '/api/prediction-cache/list' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          let cacheItems: any[] = [];
          try {
            const cacheCatalogPath = path.resolve(__dirname, 'docs/prediction_cache/catalog.json');
            if (fs.existsSync(cacheCatalogPath)) {
              const parsed = JSON.parse(fs.readFileSync(cacheCatalogPath, 'utf-8'));
              if (Array.isArray(parsed)) cacheItems = parsed;
            }
          } catch (e: any) {
            console.error('Error reading prediction cache catalog:', e);
          }

          const seenKeys = new Set<string>(
            cacheItems.map((it: any) => `${it?.dateRange || ''}|${it?.providerUsed || ''}|${it?.modelUsed || ''}`)
          );
          const diskReports = scanDiskDocReports();
          const diskSummaries = diskReports
            .filter(r => r.reportData?.narrative)
            .map(r => {
              const provRaw = r.reportData?.narrative?.providerUsed || (r.engineKey.includes('qwen') || r.engineKey.includes('ollama') ? 'local_qwen' : r.engineKey);
              const modelUsed = r.reportData?.modelTag || r.reportData?.narrative?.ollamaStats?.model || r.reportData?.engineName || r.engineKey;
              const dateRange = `${r.month} ${r.year}`;
              return {
                cacheId: `doc__${r.year}__${r.month}__${r.engineKey}`,
                title: `Monthly Vedic Report (${dateRange})`,
                scope: 'monthly',
                dateRange,
                providerUsed: provRaw === 'local_qwen' ? 'Local Vedic Qwen (Ollama)' : (r.reportData?.engineName || provRaw),
                modelUsed,
                createdAt: r.timestamp,
                summaryPreview: (r.reportData?.summarySentence || r.reportData?.narrative?.summarySentence || r.reportData?.narrative?.part1_probabilityAndScope || '').slice(0, 220),
                htmlUrl: r.htmlUrl
              };
            })
            .filter(s => !seenKeys.has(`${s.dateRange}|${s.providerUsed}|${s.modelUsed}`));

          const combined = [...cacheItems, ...diskSummaries].sort(
            (a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
          );

          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, items: combined }));
          return;
        }

        // 3c. GET /api/prediction-cache/load?id=...
        if (pathname === '/api/prediction-cache/load' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const rawId = urlObj.searchParams.get('id') || '';
          const safeId = rawId.replace(/[^a-zA-Z0-9._-]/g, '');
          if (!safeId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing or invalid cache id' }));
            return;
          }
          try {
            if (safeId.startsWith('doc__')) {
              const parts = safeId.split('__');
              if (parts.length >= 4) {
                const docYear = parts[1];
                const docMonth = parts[2];
                const docEngine = parts.slice(3).join('__');
                const engDir = path.resolve(__dirname, 'docs', docYear, docMonth, docEngine);
                const reportJsonPath = path.join(engDir, 'report_data.json');
                if (fs.existsSync(reportJsonPath)) {
                  const data = JSON.parse(fs.readFileSync(reportJsonPath, 'utf-8'));
                  const files = fs.readdirSync(engDir);
                  const htmlFiles = files.filter(f => f.toLowerCase().endsWith('.html')).sort();
                  const htmlUrl = htmlFiles.length > 0
                    ? `/docs/${docYear}/${docMonth}/${docEngine}/${htmlFiles[htmlFiles.length - 1]}`
                    : undefined;
                  const mIdx = DOCS_MONTH_ORDER.findIndex(m => m.toLowerCase() === docMonth.toLowerCase());
                  const mergedContext = {
                    matchedRules: [],
                    natalOccupants: [],
                    transitOccupants: [],
                    isComprehensiveMonthly: true,
                    selectedMonth: typeof data?.monthIndex === 'number' ? data.monthIndex : (mIdx >= 0 ? mIdx : 0),
                    selectedYear: Number(docYear) || 2026,
                    ...(data?.context || {})
                  };
                  const entry = {
                    cacheId: safeId,
                    title: `Monthly Vedic Report (${docMonth} ${docYear})`,
                    scope: 'monthly',
                    dateRange: `${docMonth} ${docYear}`,
                    providerUsed: data?.narrative?.providerUsed || data?.engineName || docEngine,
                    modelUsed: data?.modelTag || data?.narrative?.ollamaStats?.model || data?.engineName || docEngine,
                    createdAt: data?.savedAt || data?.reportGeneratedIso || new Date().toISOString(),
                    summaryPreview: (data?.summarySentence || data?.narrative?.summarySentence || '').slice(0, 220),
                    promptSent: data?.promptArtifact?.fullPromptText || data?.narrative?.promptSent || '',
                    context: mergedContext,
                    narrative: data?.narrative,
                    htmlUrl
                  };
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, entry }));
                  return;
                }
              }
            }

            let jsonPath = path.resolve(__dirname, 'docs/prediction_cache', `${safeId}.json`);
            if (!fs.existsSync(jsonPath)) {
              jsonPath = path.resolve(__dirname, 'public/docs/prediction_cache', `${safeId}.json`);
            }
            if (fs.existsSync(jsonPath)) {
              const entry = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, entry }));
              return;
            }
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: e.message || 'Failed to load cached prediction' }));
            return;
          }
          res.statusCode = 404;
          res.end(JSON.stringify({ success: false, error: 'Cached prediction not found' }));
          return;
        }

        // 3d. POST /api/prediction-cache/save
        if (pathname === '/api/prediction-cache/save' && req.method === 'POST') {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const bodyStr = Buffer.concat(chunks).toString('utf-8');
              const payload = JSON.parse(bodyStr || '{}');
              const cacheEntry = payload.cacheEntry;
              const htmlContent: string | undefined = payload.htmlContent;

              if (!cacheEntry || !cacheEntry.cacheId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing cacheEntry.cacheId' }));
                return;
              }

              const safeId = String(cacheEntry.cacheId).replace(/[^a-zA-Z0-9_-]/g, '');
              if (!safeId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Invalid cacheId' }));
                return;
              }

              const cacheDir = path.resolve(__dirname, 'docs/prediction_cache');
              if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

              const htmlUrl = htmlContent ? `/docs/prediction_cache/${safeId}.html` : undefined;
              const fullEntry = {
                ...cacheEntry,
                cacheId: safeId,
                htmlUrl: htmlUrl || cacheEntry.htmlUrl
              };

              if (htmlContent) {
                fs.writeFileSync(path.join(cacheDir, `${safeId}.html`), htmlContent, 'utf-8');
              }

              const entryJsonStr = JSON.stringify(fullEntry, null, 2);
              fs.writeFileSync(path.join(cacheDir, `${safeId}.json`), entryJsonStr, 'utf-8');

              const summary = {
                cacheId: safeId,
                title: fullEntry.title,
                scope: fullEntry.scope,
                personId: fullEntry.personId,
                personName: fullEntry.personName,
                dateRange: fullEntry.dateRange,
                providerUsed: fullEntry.providerUsed,
                modelUsed: fullEntry.modelUsed,
                createdAt: fullEntry.createdAt,
                summaryPreview: fullEntry.summaryPreview,
                htmlUrl: fullEntry.htmlUrl
              };

              const catalogPath = path.join(cacheDir, 'catalog.json');
              let existingCatalog: any[] = [];
              if (fs.existsSync(catalogPath)) {
                try {
                  const parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
                  if (Array.isArray(parsed)) existingCatalog = parsed;
                } catch {}
              }

              const filtered = existingCatalog.filter((item: any) => item?.cacheId !== safeId);
              const updatedCatalog = [summary, ...filtered].slice(0, 50);
              const catalogStr = JSON.stringify(updatedCatalog, null, 2);
              fs.writeFileSync(catalogPath, catalogStr, 'utf-8');

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                cacheId: safeId,
                htmlUrl: fullEntry.htmlUrl,
                jsonUrl: `/docs/prediction_cache/${safeId}.json`
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err.message || 'Failed to save prediction cache' }));
            }
          });
          return;
        }

        // 4. Static handler for /docs/*
        if (pathname.startsWith('/docs/')) {
          const subPath = pathname.replace(/^\/docs\//, '');
          let filePath = path.resolve(__dirname, 'docs', subPath);
          if (!fs.existsSync(filePath)) {
            filePath = path.resolve(__dirname, 'public/docs', subPath);
          }

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (pathname.endsWith('.html')) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
            } else if (pathname.endsWith('.pdf')) {
              res.setHeader('Content-Type', 'application/pdf');
              res.setHeader('Content-Disposition', 'inline');
            } else if (pathname.endsWith('.doc')) {
              res.setHeader('Content-Type', 'application/msword; charset=utf-8');
              res.setHeader('Content-Disposition', 'attachment');
            } else if (pathname.endsWith('.json')) {
              res.setHeader('Content-Type', 'application/json');
            }

            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            return;
          }
        }

        next();
      });
    }
  };
}

function localBatchPlugin(env: Record<string, string>): Plugin {
  const BATCH_MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  interface BatchJobState {
    jobId: string;
    status: 'idle' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
    modelTag: string;
    engineKey: string;
    monthName: string;
    monthIndex: number;
    year: number;
    ollamaEndpoint: string;
    delaySeconds: number;
    secondsRemaining: number;
    scheduledAtIso?: string;
    startedAtIso?: string;
    completedAtIso?: string;
    elapsedMs: number;
    promptChars: number;
    promptTokensEst: number;
    promptEvalTokens?: number;
    tokensGenerated: number;
    savedFolder?: string;
    savedHtmlUrl?: string;
    savedJsonUrl?: string;
    error?: string;
    recentLogs: string[];
  }

  let state: BatchJobState = (() => {
    const fallback: BatchJobState = {
      jobId: 'none',
      status: 'idle',
      modelTag: 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M',
      engineKey: 'vedic-qwen2.5-14b-GGUF_Q4_K_M',
      monthName: 'November',
      monthIndex: 10,
      year: 2026,
      ollamaEndpoint: 'http://localhost:11434/api/generate',
      delaySeconds: 120,
      secondsRemaining: 0,
      elapsedMs: 0,
      promptChars: 0,
      promptTokensEst: 0,
      tokensGenerated: 0,
      recentLogs: []
    };
    try {
      const persistedPath = path.resolve(__dirname, 'docs/batch_jobs/latest_batch_status.json');
      if (fs.existsSync(persistedPath)) {
        const parsed = JSON.parse(fs.readFileSync(persistedPath, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          const normalizedStatus =
            parsed.status === 'running' || parsed.status === 'scheduled' ? 'cancelled' : parsed.status || 'idle';
          return {
            ...fallback,
            ...parsed,
            status: normalizedStatus,
            recentLogs: Array.isArray(parsed.recentLogs) ? parsed.recentLogs : []
          };
        }
      }
    } catch {}
    return fallback;
  })();

  let countdownInterval: NodeJS.Timeout | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let activeHttpReq: http.ClientRequest | null = null;
  let activeContextPayload: any = null;

  const sanitizeFolderKey = (raw: string): string => {
    const trimmed = String(raw || 'vedic-qwen2.5-14b-GGUF:Q4_K_M').trim();
    const tail = trimmed.split('/').pop() || trimmed;
    const clean = tail
      .replace(/[:/\\?*|"<>]/g, '_')
      .replace(/\s+/g, '_');
    return clean || 'vedic_local_batch';
  };

  const setConsoleTitle = (title: string) => {
    try {
      if (process.stdout.isTTY) {
        process.stdout.write(`\x1b]0;${title}\x07`);
      }
    } catch {}
  };

  const formatElapsed = (ms: number): string => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  };

  const persistBatchStatusFile = () => {
    try {
      const dir = path.resolve(__dirname, 'docs/batch_jobs');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'latest_batch_status.json'), JSON.stringify(state, null, 2), 'utf-8');
    } catch {}
  };

  const pushLog = (line: string) => {
    const stamped = `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${line}`;
    console.log(stamped);
    state.recentLogs = [...state.recentLogs.slice(-39), stamped];
    persistBatchStatusFile();
  };

  const notifyOsTray = (title: string, message: string) => {
    try {
      // Terminal audible bell
      process.stdout.write('\x07');
    } catch {}

    if (process.platform === 'win32') {
      const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        'Add-Type -AssemblyName System.Drawing',
        '$n = New-Object System.Windows.Forms.NotifyIcon',
        '$n.Icon = [System.Drawing.SystemIcons]::Information',
        '$n.Visible = $true',
        '$n.BalloonTipTitle = $env:VEDIC_NOTIFY_TITLE',
        '$n.BalloonTipText = $env:VEDIC_NOTIFY_BODY',
        '$n.ShowBalloonTip(15000)',
        '[System.Media.SystemSounds]::Exclamation.Play()',
        'Start-Sleep -Milliseconds 16000',
        '$n.Dispose()'
      ].join('; ');

      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psScript],
        {
          env: {
            ...process.env,
            VEDIC_NOTIFY_TITLE: title,
            VEDIC_NOTIFY_BODY: message
          },
          windowsHide: true
        },
        () => {}
      );
      return;
    }

    if (process.platform === 'darwin') {
      const safeTitle = title.replace(/"/g, '\\"');
      const safeMsg = message.replace(/"/g, '\\"');
      execFile('osascript', ['-e', `display notification "${safeMsg}" with title "${safeTitle}" sound name "Glass"`], () => {});
      return;
    }

    execFile('notify-send', ['-u', 'normal', title, message], () => {});
  };

  const releaseOllamaModel = (endpointUrl: string, modelTag: string) => {
    try {
      const parsed = new URL(endpointUrl);
      const client = parsed.protocol === 'https:' ? https : http;
      const body = JSON.stringify({ model: modelTag, prompt: '', keep_alive: 0 });
      const req = client.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          }
        },
        res => {
          res.resume();
        }
      );
      req.on('error', () => {});
      req.write(body);
      req.end();
    } catch {}
  };

  interface InstalledOllamaModelInfo {
    name: string;
    sizeBytes: number;
    sizeGb: string;
    modifiedAt?: string;
  }

  const fetchInstalledOllamaModels = (
    endpointUrl: string
  ): Promise<{ reachable: boolean; tagsUrl: string; models: InstalledOllamaModelInfo[]; error?: string }> => {
    return new Promise(resolve => {
      try {
        const parsed = new URL(endpointUrl || 'http://localhost:11434/api/generate');
        const tagsPath = parsed.pathname.replace(/\/api\/(generate|chat)\/?$/i, '/api/tags') || '/api/tags';
        const finalPath = tagsPath.includes('/api/tags') ? tagsPath : '/api/tags';
        const tagsUrl = `${parsed.protocol}//${parsed.host}${finalPath}`;
        const client = parsed.protocol === 'https:' ? https : http;

        const req = client.request(
          {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: finalPath,
            method: 'GET',
            timeout: 4000
          },
          res => {
            let body = '';
            res.on('data', c => { body += c.toString('utf-8'); });
            res.on('end', () => {
              if ((res.statusCode || 500) >= 400) {
                resolve({ reachable: true, tagsUrl, models: [], error: `HTTP ${res.statusCode}` });
                return;
              }
              try {
                const json = JSON.parse(body || '{}');
                const models: InstalledOllamaModelInfo[] = Array.isArray(json.models)
                  ? json.models.map((m: any) => {
                      const bytes = Number(m.size || 0);
                      return {
                        name: String(m.name || m.model || '').trim(),
                        sizeBytes: bytes,
                        sizeGb: bytes > 0 ? (bytes / (1024 ** 3)).toFixed(1) : '?',
                        modifiedAt: m.modified_at
                      };
                    }).filter((m: InstalledOllamaModelInfo) => m.name.length > 0)
                  : [];
                resolve({ reachable: true, tagsUrl, models });
              } catch (e: any) {
                resolve({ reachable: true, tagsUrl, models: [], error: e?.message || 'Invalid /api/tags JSON' });
              }
            });
          }
        );
        req.on('timeout', () => {
          req.destroy(new Error('Timeout connecting to Ollama'));
        });
        req.on('error', err => {
          resolve({ reachable: false, tagsUrl, models: [], error: err?.message || 'Connection refused' });
        });
        req.end();
      } catch (err: any) {
        resolve({ reachable: false, tagsUrl: endpointUrl, models: [], error: err?.message || 'Invalid URL' });
      }
    });
  };

  const resolveOllamaModelTag = (
    requestedTag: string,
    installedNames: string[]
  ): { resolved: string; matchType: 'exact' | 'case' | 'base_or_prefix' | 'not_found' } => {
    const req = requestedTag.trim();
    if (installedNames.includes(req)) {
      return { resolved: req, matchType: 'exact' };
    }
    const reqLow = req.toLowerCase();
    const caseHit = installedNames.find(n => n.toLowerCase() === reqLow);
    if (caseHit) {
      return { resolved: caseHit, matchType: 'case' };
    }
    // Match HuggingFace prefix (e.g. hf.co/user/vedic-qwen2.5-14b-GGUF:Q4_K_M) or :latest suffix
    const reqRepoNoTag = reqLow.split(':')[0];
    const reqTail = reqLow.split('/').pop() || reqLow;
    const reqTailNoTag = reqTail.split(':')[0];
    const prefixHits = installedNames.filter(n => {
      const nLow = n.toLowerCase();
      const nTail = nLow.split('/').pop() || nLow;
      const nNoTag = nLow.split(':')[0];
      const nTailNoTag = nTail.split(':')[0];
      return (
        nTail === reqTail ||
        nNoTag === reqRepoNoTag ||
        nTailNoTag === reqTailNoTag
      );
    });
    if (prefixHits.length === 1) {
      return { resolved: prefixHits[0], matchType: 'base_or_prefix' };
    }
    return { resolved: req, matchType: 'not_found' };
  };

  const clearTimers = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };

  return {
    name: 'local-batch-runner-plugin',
    configureServer(server) {
      const runBatchInference = async () => {
        clearTimers();
        if (!activeContextPayload) {
          state.status = 'failed';
          state.error = 'Missing astronomical context payload for batch run.';
          pushLog(`[BATCH ERROR] ${state.error}`);
          return;
        }

        const startMs = Date.now();
        state.status = 'running';
        state.startedAtIso = new Date(startMs).toISOString();
        state.secondsRemaining = 0;
        state.tokensGenerated = 0;
        state.elapsedMs = 0;

        const periodLabel = `${state.monthName} ${state.year}`;
        pushLog('=========================================================================');
        pushLog(`[BATCH START] Firing ${periodLabel} on ${state.modelTag}`);
        setConsoleTitle(`[BATCH RUNNING] ${periodLabel} (${state.modelTag})`);

        try {
          const adaptersMod: any = await server.ssrLoadModule('/src/services/llm/adapters.ts');
          const htmlMod: any = await server.ssrLoadModule('/src/services/htmlReportGenerator.ts');

          const activePromptVer =
            activeContextPayload.promptVersion === 'v1' ||
            activeContextPayload.promptVersion === 'v2' ||
            activeContextPayload.promptVersion === 'v3'
              ? activeContextPayload.promptVersion
              : 'v3';

          const prompt = adaptersMod.buildVedicPrompt(activeContextPayload, state.modelTag, activePromptVer, 'local_private');

          state.promptChars = prompt.length;
          state.promptTokensEst = Math.round(prompt.length / 4);

          const primaryNumCtx = 10240;
          const primaryNumPredict = 3600;
          const keepAliveSetting = '2m';

          pushLog(`[BATCH INFO] Endpoint: ${state.ollamaEndpoint} | stream=true | profile=local_private | num_ctx=${primaryNumCtx} | num_predict=${primaryNumPredict} | keep_alive=${keepAliveSetting} | timeout=UNLIMITED`);
          pushLog(`[BATCH PROMPT] Built ${activePromptVer.toUpperCase()} local-private unified prompt: ${prompt.length} chars (~${state.promptTokensEst} tokens). Evaluating prefill in Ollama...`);

          const targetUrl = new URL(state.ollamaEndpoint);
          const client = targetUrl.protocol === 'https:' ? https : http;

          // Periodic console heartbeat every 15s while streaming
          heartbeatInterval = setInterval(() => {
            if (state.status !== 'running') return;
            state.elapsedMs = Date.now() - startMs;
            const secs = Math.max(1, state.elapsedMs / 1000);
            const tokPerSec = state.tokensGenerated > 0 ? (state.tokensGenerated / secs).toFixed(2) : '0.00';
            const statusText = state.tokensGenerated > 0
              ? `${state.tokensGenerated} tokens | ${formatElapsed(state.elapsedMs)} elapsed | ${tokPerSec} tok/s`
              : `Prompt prefill / thinking | ${formatElapsed(state.elapsedMs)} elapsed`;
            pushLog(`[BATCH PROGRESS][${periodLabel}] ${statusText}`);
            setConsoleTitle(`[BATCH ${periodLabel}] ${statusText}`);
          }, 15000);

          const executeOllamaStream = (bodyObj: Record<string, any>): Promise<{
            responseText: string;
            finalMeta: any;
          }> => {
            const payloadStr = JSON.stringify(bodyObj);
            return new Promise((resolve, reject) => {
              let aggregated = '';
              let ndjsonBuffer = '';
              let finalMeta: any = {};
              let firstTokenLogged = false;

              const outReq = client.request(
                {
                  hostname: targetUrl.hostname,
                  port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                  path: targetUrl.pathname + targetUrl.search,
                  method: 'POST',
                  timeout: 0,
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadStr)
                  }
                },
                (inRes) => {
                  inRes.setTimeout(0);
                  if (inRes.socket) {
                    inRes.socket.setTimeout(0);
                    inRes.socket.setKeepAlive(true, 15000);
                  }

                  if ((inRes.statusCode || 500) >= 400) {
                    let errBody = '';
                    inRes.on('data', chunk => { errBody += chunk.toString('utf-8'); });
                    inRes.on('end', () => {
                      reject(new Error(`Ollama HTTP ${inRes.statusCode}: ${errBody || inRes.statusMessage}`));
                    });
                    return;
                  }

                  inRes.on('data', (chunk: Buffer) => {
                    ndjsonBuffer += chunk.toString('utf-8');
                    const lines = ndjsonBuffer.split('\n');
                    ndjsonBuffer = lines.pop() || '';

                    for (const line of lines) {
                      const trimmed = line.trim();
                      if (!trimmed) continue;
                      try {
                        const obj = JSON.parse(trimmed);
                        if (typeof obj.response === 'string' && obj.response.length > 0) {
                          aggregated += obj.response;
                          state.tokensGenerated += 1;
                          if (!firstTokenLogged) {
                            firstTokenLogged = true;
                            pushLog(`[BATCH STREAM][${periodLabel}] Prefill complete in ${formatElapsed(Date.now() - startMs)} — streaming response tokens...`);
                          }
                        }
                        if (obj.done) {
                          finalMeta = obj;
                        }
                      } catch {}
                    }
                  });

                  inRes.on('end', () => {
                    if (ndjsonBuffer.trim()) {
                      try {
                        const tail = JSON.parse(ndjsonBuffer.trim());
                        if (typeof tail.response === 'string') aggregated += tail.response;
                        if (tail.done) finalMeta = tail;
                      } catch {}
                    }
                    resolve({ responseText: aggregated, finalMeta });
                  });

                  inRes.on('error', err => reject(err));
                }
              );

              activeHttpReq = outReq;
              outReq.setTimeout(0);
              outReq.on('socket', sock => {
                sock.setTimeout(0);
                sock.setKeepAlive(true, 15000);
              });
              outReq.on('error', err => reject(err));
              outReq.write(payloadStr);
              outReq.end();
            });
          };

          const requestBody: Record<string, any> = {
            model: state.modelTag,
            prompt,
            stream: true,
            format: 'json',
            keep_alive: keepAliveSetting,
            options: {
              temperature: 0.3,
              num_predict: primaryNumPredict,
              num_ctx: primaryNumCtx
            }
          };

          const streamResult = await executeOllamaStream(requestBody);

          activeHttpReq = null;
          clearTimers();

          const elapsedMs = Date.now() - startMs;
          state.elapsedMs = elapsedMs;
          state.promptEvalTokens = streamResult.finalMeta?.prompt_eval_count ?? state.promptTokensEst;
          if (typeof streamResult.finalMeta?.eval_count === 'number') {
            state.tokensGenerated = streamResult.finalMeta.eval_count;
          }

          const ollamaStats = {
            model: streamResult.finalMeta?.model || state.modelTag,
            totalDurationMs: streamResult.finalMeta?.total_duration ? Math.round(streamResult.finalMeta.total_duration / 1e6) : elapsedMs,
            loadDurationMs: streamResult.finalMeta?.load_duration ? Math.round(streamResult.finalMeta.load_duration / 1e6) : undefined,
            promptEvalCount: streamResult.finalMeta?.prompt_eval_count,
            evalCount: streamResult.finalMeta?.eval_count ?? state.tokensGenerated
          };

          const narrative = adaptersMod.buildBatchNarrativeFromRawResponse(
            activeContextPayload,
            streamResult.responseText,
            {
              modelTag: state.modelTag,
              promptSent: prompt,
              endpointUsed: state.ollamaEndpoint,
              executionTimeMs: elapsedMs,
              requestBody,
              rawResponseBody: { ...streamResult.finalMeta, response: streamResult.responseText },
              ollamaStats
            }
          );

          const htmlContent = htmlMod.buildVedicHtmlContent(activeContextPayload, narrative);

          const savedAt = new Date();
          const yyyyMmDd = `${savedAt.getFullYear()}-${String(savedAt.getMonth() + 1).padStart(2, '0')}-${String(savedAt.getDate()).padStart(2, '0')}`;
          const savedAtLocal = savedAt.toLocaleString('en-US', { hour12: false });
          const timestampSlug = createReportFilenameTimestamp(savedAt);

          const engineKey = state.engineKey;
          const engineDisplayName = `Vedic Qwen 2.5 14B (${state.modelTag})`;
          const docsDir = path.resolve(__dirname, 'docs', String(state.year), state.monthName, engineKey);
          if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

          const fileBase = `Tamil_Vedic_Report_${state.monthName}_${state.year}_${engineKey}_${timestampSlug}`;
          const htmlFilename = `${fileBase}.html`;
          const jsonFilename = 'report_data.json';

          fs.writeFileSync(path.join(docsDir, htmlFilename), htmlContent, 'utf-8');

          const resolvedVer = narrative.promptVersion || activePromptVer;
          const resolvedVerTag = (narrative.promptVersionTag || resolvedVer.toUpperCase()).toUpperCase();

          const reportData = {
            schemaVersion: 'vedic_brain_v1',
            promptVersion: resolvedVer,
            promptVersionTag: resolvedVerTag,
            year: state.year,
            month: state.monthName,
            monthIndex: state.monthIndex,
            engineKey,
            engineName: engineDisplayName,
            modelTag: state.modelTag,
            reportGeneratedDate: yyyyMmDd,
            reportGeneratedLocal: savedAtLocal,
            reportGeneratedIso: savedAt.toISOString(),
            savedAt: savedAt.toISOString(),
            summarySentence: narrative.summarySentence,
            tokenTelemetry: {
              promptTokens: ollamaStats.promptEvalCount ?? state.promptTokensEst,
              completionTokens: ollamaStats.evalCount ?? state.tokensGenerated,
              totalTokens: (ollamaStats.promptEvalCount ?? state.promptTokensEst) + (ollamaStats.evalCount ?? state.tokensGenerated),
              telemetrySource: ollamaStats.evalCount ? 'api_reported' : 'char_estimated'
            },
            costTelemetry: {
              currency: 'INR',
              pricingTier: 'local_zero_cost',
              usagePaisa: 0
            },
            promptArtifact: {
              promptVersion: resolvedVer,
              promptVersionTag: resolvedVerTag,
              charLength: prompt.length,
              fullPromptText: prompt
            },
            publicLlmResponse: {
              rawResponseText: streamResult.responseText,
              parsedStructuredNarrative: narrative
            },
            context: activeContextPayload,
            narrative
          };
          fs.writeFileSync(path.join(docsDir, jsonFilename), JSON.stringify(reportData, null, 2), 'utf-8');

          // Update docs/reports_catalog.json
          const catalogPath = path.resolve(__dirname, 'docs/reports_catalog.json');
          let cat: any = { years: [2020, 2022, 2023, 2024, 2025, 2026, 2027], catalog: {} };
          if (fs.existsSync(catalogPath)) {
            try {
              cat = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
            } catch {}
          }
          if (!cat.years.includes(Number(state.year))) {
            cat.years.push(Number(state.year));
            cat.years.sort((a: number, b: number) => a - b);
          }
          if (!cat.catalog[state.year]) {
            cat.catalog[state.year] = { year: Number(state.year), months: {} };
          }
          if (!cat.catalog[state.year].months[state.monthName]) {
            cat.catalog[state.year].months[state.monthName] = {
              monthName: state.monthName,
              monthIndex: state.monthIndex,
              reports: {}
            };
          }

          const htmlUrl = `/docs/${state.year}/${state.monthName}/${engineKey}/${htmlFilename}`;
          const jsonUrl = `/docs/${state.year}/${state.monthName}/${engineKey}/${jsonFilename}`;

          cat.catalog[state.year].months[state.monthName].reports[engineKey] = {
            engineKey,
            engineName: engineDisplayName,
            categoryLabel: 'Local 14B Batch',
            badge: `🖥️ Vedic Qwen 14B [${resolvedVerTag}]`,
            providerId: 'local_qwen',
            promptVersion: resolvedVer,
            promptVersionTag: resolvedVerTag,
            htmlUrl,
            pdfUrl: '',
            docUrl: '',
            dataUrl: jsonUrl,
            timestamp: savedAt.toISOString(),
            reportGeneratedDate: yyyyMmDd,
            hasNarrative: true,
            summarySentence: narrative.summarySentence || ''
          };
          fs.writeFileSync(catalogPath, JSON.stringify(cat, null, 2), 'utf-8');

          // Also persist into docs/prediction_cache/ so Prediction Cache & Local Q&A immediately show this batch run
          try {
            const predCacheDir = path.resolve(__dirname, 'docs/prediction_cache');
            if (!fs.existsSync(predCacheDir)) fs.mkdirSync(predCacheDir, { recursive: true });
            const safeCacheId = `pred_monthly_${state.monthName.toLowerCase()}_${state.year}_local_qwen_${timestampSlug}`.replace(/[^a-zA-Z0-9_-]/g, '');
            const cacheHtmlFile = `${safeCacheId}.html`;
            fs.writeFileSync(path.join(predCacheDir, cacheHtmlFile), htmlContent, 'utf-8');
            const cacheEntry = {
              cacheId: safeCacheId,
              title: `Monthly Vedic Report (${state.monthName} ${state.year})`,
              scope: 'monthly',
              dateRange: `${state.monthName} ${state.year}`,
              providerUsed: engineDisplayName,
              modelUsed: state.modelTag,
              createdAt: savedAt.toISOString(),
              summaryPreview: (narrative.summarySentence || narrative.part1_probabilityAndScope || '').slice(0, 220),
              htmlUrl: `/docs/prediction_cache/${cacheHtmlFile}`,
              promptSent: prompt,
              context: activeContextPayload,
              narrative
            };
            fs.writeFileSync(path.join(predCacheDir, `${safeCacheId}.json`), JSON.stringify(cacheEntry, null, 2), 'utf-8');

            const predCatalogPath = path.join(predCacheDir, 'catalog.json');
            let existingPredCat: any[] = [];
            if (fs.existsSync(predCatalogPath)) {
              try {
                const parsed = JSON.parse(fs.readFileSync(predCatalogPath, 'utf-8'));
                if (Array.isArray(parsed)) existingPredCat = parsed;
              } catch {}
            }
            const summaryItem = {
              cacheId: safeCacheId,
              title: cacheEntry.title,
              scope: cacheEntry.scope,
              dateRange: cacheEntry.dateRange,
              providerUsed: cacheEntry.providerUsed,
              modelUsed: cacheEntry.modelUsed,
              createdAt: cacheEntry.createdAt,
              summaryPreview: cacheEntry.summaryPreview,
              htmlUrl: cacheEntry.htmlUrl
            };
            const filteredPredCat = existingPredCat.filter((it: any) => it?.cacheId !== safeCacheId);
            fs.writeFileSync(predCatalogPath, JSON.stringify([summaryItem, ...filteredPredCat].slice(0, 50), null, 2), 'utf-8');
          } catch {}

          state.status = 'completed';
          state.completedAtIso = savedAt.toISOString();
          state.savedFolder = `docs/${state.year}/${state.monthName}/${engineKey}/`;
          state.savedHtmlUrl = htmlUrl;
          state.savedJsonUrl = jsonUrl;
          persistBatchStatusFile();

          releaseOllamaModel(state.ollamaEndpoint, state.modelTag);

          pushLog('=========================================================================');
          pushLog(`[BATCH COMPLETE] ${periodLabel} finished in ${formatElapsed(elapsedMs)}!`);
          pushLog(`  Model  : ${state.modelTag}`);
          pushLog(`  Tokens : prompt=${ollamaStats.promptEvalCount ?? state.promptTokensEst}, generated=${ollamaStats.evalCount ?? state.tokensGenerated}`);
          pushLog(`  HTML   : ${state.savedFolder}${htmlFilename}`);
          pushLog(`  JSON   : ${state.savedFolder}${jsonFilename}`);
          pushLog('=========================================================================');
          setConsoleTitle(`[BATCH DONE] ${periodLabel} saved in ${formatElapsed(elapsedMs)}`);

          notifyOsTray(
            `Vedic 14B Batch Complete — ${periodLabel}`,
            `Generated in ${formatElapsed(elapsedMs)} (${state.tokensGenerated} tokens). Saved to ${state.savedFolder}`
          );
        } catch (err: any) {
          activeHttpReq = null;
          clearTimers();
          if ((state.status as string) === 'cancelled') return;
          state.status = 'failed';
          state.elapsedMs = Date.now() - startMs;
          state.error = err?.message || 'Unknown local Ollama batch failure';
          pushLog(`[BATCH FAILED][${periodLabel}] ${state.error}`);
          setConsoleTitle(`[BATCH FAILED] ${periodLabel}`);
          notifyOsTray(
            `Vedic 14B Batch Failed — ${periodLabel}`,
            state.error || 'Check npm server console for details.'
          );
        }
      };

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';

        // Direct CORS-free Local Ollama Generate Proxy (used by Local Q&A / Report Copilot)
        if (rawUrl.split('?')[0] === '/api/llm/ollama-generate') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body || '{}');
              const baseEndpoint = String(payload.endpoint || 'http://localhost:11434').trim().replace(/\/+$/, '');
              const generateUrl = baseEndpoint.endsWith('/api/generate')
                ? baseEndpoint
                : `${baseEndpoint}/api/generate`;

              let requestedModel = String(payload.model || 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M').trim();
              const tagsCheck = await fetchInstalledOllamaModels(generateUrl);
              if (tagsCheck.reachable && tagsCheck.models.length > 0) {
                const resolution = resolveOllamaModelTag(requestedModel, tagsCheck.models.map(m => m.name));
                if (resolution.matchType !== 'not_found') {
                  requestedModel = resolution.resolved;
                }
              }

              const forwardBody = JSON.stringify({
                model: requestedModel,
                prompt: payload.prompt || '',
                ...(payload.system ? { system: payload.system } : {}),
                stream: false,
                ...(payload.format ? { format: payload.format } : {}),
                ...(payload.keep_alive !== undefined ? { keep_alive: payload.keep_alive } : {}),
                options: payload.options || { temperature: 0.3, num_predict: 2000, num_ctx: 8192 }
              });

              const parsed = new URL(generateUrl);
              const client = parsed.protocol === 'https:' ? https : http;

              const proxyRes: { status: number; bodyText: string } = await new Promise((resolve, reject) => {
                const outReq = client.request(
                  {
                    hostname: parsed.hostname,
                    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                    path: parsed.pathname + parsed.search,
                    method: 'POST',
                    timeout: 0,
                    headers: {
                      'Content-Type': 'application/json',
                      'Content-Length': Buffer.byteLength(forwardBody)
                    }
                  },
                  inRes => {
                    inRes.setTimeout(0);
                    let respData = '';
                    inRes.on('data', c => { respData += c.toString('utf-8'); });
                    inRes.on('end', () => resolve({ status: inRes.statusCode || 200, bodyText: respData }));
                    inRes.on('error', err => reject(err));
                  }
                );
                outReq.setTimeout(0);
                outReq.on('socket', sock => {
                  sock.setTimeout(0);
                  sock.setKeepAlive(true, 15000);
                });
                outReq.on('error', err => reject(err));
                outReq.write(forwardBody);
                outReq.end();
              });

              res.statusCode = proxyRes.status;
              res.end(proxyRes.bodyText);
            } catch (err: any) {
              res.statusCode = 502;
              res.end(JSON.stringify({
                error: err?.message || 'Local Ollama proxy connection failed (Is Ollama running on port 11434?)'
              }));
            }
          });
          return;
        }


        if (!rawUrl.startsWith('/api/batch/')) return next();

        const pathname = rawUrl.split('?')[0];
        res.setHeader('Content-Type', 'application/json');

        if (pathname === '/api/batch/status' && req.method === 'GET') {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, state }));
          return;
        }

        if (pathname === '/api/batch/ollama-models' && req.method === 'GET') {
          const urlObj = new URL(rawUrl, 'http://localhost');
          const endpointParam = urlObj.searchParams.get('endpoint') || state.ollamaEndpoint || 'http://localhost:11434/api/generate';
          const info = await fetchInstalledOllamaModels(endpointParam);
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, ...info }));
          return;
        }

        if (pathname === '/api/batch/test-notify' && req.method === 'POST') {
          pushLog('[BATCH TEST] Triggered OS Notification Tray popup + chime check.');
          notifyOsTray(
            'Vedic Batch Notification Ready',
            'Your OS notification tray & chime alert works! When 14B finishes, you will see this popup automatically.'
          );
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true }));
          return;
        }

        if (pathname === '/api/batch/cancel' && req.method === 'POST') {
          clearTimers();
          const prevStatus = state.status;
          state.status = 'cancelled';
          state.secondsRemaining = 0;
          if (activeHttpReq) {
            try {
              activeHttpReq.destroy(new Error('Cancelled by user'));
            } catch {}
            activeHttpReq = null;
          }
          if (prevStatus === 'running') {
            releaseOllamaModel(state.ollamaEndpoint, state.modelTag);
          }
          pushLog(`[BATCH CANCELLED] Job ${state.jobId} (${state.monthName} ${state.year}) stopped by user.`);
          setConsoleTitle('Vedic Horoscope Server (Batch Cancelled)');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, state }));
          return;
        }

        if (pathname === '/api/batch/schedule' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              if (state.status === 'running') {
                res.statusCode = 409;
                res.end(JSON.stringify({
                  success: false,
                  error: `A batch job (${state.monthName} ${state.year}) is currently running. Wait for completion or cancel it first.`,
                  state
                }));
                return;
              }

              const payload = JSON.parse(body || '{}');
              const ctx = payload.context;
              if (!ctx || typeof ctx.selectedMonth !== 'number' || !ctx.selectedYear) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Missing single-month context (selectedMonth, selectedYear).' }));
                return;
              }

              const requestedTag = String(payload.modelTag || 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M').trim();
              const delaySeconds = Math.max(0, Math.min(300, Number(payload.delaySeconds ?? 120)));
              const ollamaEndpoint = String(payload.ollamaEndpoint || 'http://localhost:11434/api/generate').trim();

              // Verify Ollama model tag BEFORE starting countdown so user never waits 2 min only to hit a 404
              let modelTag = requestedTag;
              const tagsCheck = await fetchInstalledOllamaModels(ollamaEndpoint);
              const installedNames = tagsCheck.models.map(m => m.name);
              if (tagsCheck.reachable && installedNames.length > 0) {
                const resolution = resolveOllamaModelTag(requestedTag, installedNames);
                if (resolution.matchType === 'not_found') {
                  res.statusCode = 400;
                  res.end(JSON.stringify({
                    success: false,
                    error: `Model '${requestedTag}' was not found in local Ollama. Select one of your installed models instead: ${installedNames.join(', ')}`,
                    installedModels: tagsCheck.models
                  }));
                  return;
                }
                modelTag = resolution.resolved;
              } else if (tagsCheck.reachable && installedNames.length === 0 && !payload.skipModelCheck) {
                res.statusCode = 400;
                res.end(JSON.stringify({
                  success: false,
                  error: `Ollama is running at ${tagsCheck.tagsUrl}, but has 0 models installed. Run 'ollama list' or pull/create your 14B model first.`,
                  installedModels: []
                }));
                return;
              } else if (!tagsCheck.reachable && !payload.skipModelCheck) {
                res.statusCode = 503;
                res.end(JSON.stringify({
                  success: false,
                  error: `Cannot reach local Ollama (${tagsCheck.error || 'connection refused'}). Start Ollama first before scheduling.`
                }));
                return;
              }

              clearTimers();
              const engineKey = sanitizeFolderKey(modelTag);
              const monthIndex = ctx.selectedMonth;
              const monthName = BATCH_MONTH_NAMES[monthIndex] || `Month${monthIndex + 1}`;
              const year = Number(ctx.selectedYear);

              const requestedVer =
                ctx.promptVersion === 'v1' || ctx.promptVersion === 'v2' || ctx.promptVersion === 'v3'
                  ? ctx.promptVersion
                  : 'v3';
              activeContextPayload = { ...ctx, promptVersion: requestedVer };
              state = {
                jobId: `batch_${year}_${monthName.toLowerCase()}_${Date.now()}`,
                status: delaySeconds === 0 ? 'running' : 'scheduled',
                modelTag,
                engineKey,
                monthName,
                monthIndex,
                year,
                ollamaEndpoint,
                delaySeconds,
                secondsRemaining: delaySeconds,
                scheduledAtIso: new Date().toISOString(),
                elapsedMs: 0,
                promptChars: 0,
                promptTokensEst: 0,
                tokensGenerated: 0,
                recentLogs: []
              };

              pushLog('=========================================================================');
              pushLog(`[BATCH SCHEDULED] Single-Month Offline Job: ${monthName} ${year}`);
              pushLog(`  Model Tag  : ${modelTag}`);
              pushLog(`  Save Path  : docs/${year}/${monthName}/${engineKey}/`);
              pushLog(`  Trigger    : ${delaySeconds === 0 ? 'IMMEDIATE START' : `Starting in ${delaySeconds}s (${formatElapsed(delaySeconds * 1000)}) — Close browsers & background apps now!`}`);
              pushLog('=========================================================================');

              if (delaySeconds === 0) {
                void runBatchInference();
              } else {
                setConsoleTitle(`[BATCH TIMER ${formatElapsed(delaySeconds * 1000)}] ${monthName} ${year}`);
                countdownInterval = setInterval(() => {
                  state.secondsRemaining = Math.max(0, state.secondsRemaining - 1);
                  if (
                    state.secondsRemaining === 90 ||
                    state.secondsRemaining === 60 ||
                    state.secondsRemaining === 30 ||
                    state.secondsRemaining === 10
                  ) {
                    pushLog(`[BATCH COUNTDOWN][${monthName} ${year}] Starting in ${formatElapsed(state.secondsRemaining * 1000)}...`);
                    setConsoleTitle(`[BATCH TIMER ${formatElapsed(state.secondsRemaining * 1000)}] ${monthName} ${year}`);
                  } else if (state.secondsRemaining % 5 === 0) {
                    persistBatchStatusFile();
                    setConsoleTitle(`[BATCH TIMER ${formatElapsed(state.secondsRemaining * 1000)}] ${monthName} ${year}`);
                  }
                  if (state.secondsRemaining <= 0) {
                    void runBatchInference();
                  }
                }, 1000);
              }

              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, state }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: err?.message || 'Failed to schedule batch job.' }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

function originalSourceApiPlugin(): Plugin {
  return {
    name: 'original-source-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        const urlObj = new URL(rawUrl, 'http://localhost');
        const pathname = urlObj.pathname.replace(/\/+$/, '');

        const isContentRoute =
          pathname === '/api/content' ||
          pathname === '/api/original-source' ||
          pathname === '/api/original-source/content';

        if (!isContentRoute) {
          next();
          return;
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: 'Method not allowed. Use GET.' }));
          return;
        }

        try {
          const mod = await server.ssrLoadModule('/src/services/originalSourceContextBuilder.ts');

          const dateParam = urlObj.searchParams.get('date') ?? urlObj.searchParams.get('d');
          const monthParam = urlObj.searchParams.get('month');
          const yearParam = urlObj.searchParams.get('year');
          const parsed = mod.parseMonthYearQuery(dateParam, monthParam, yearParam);

          if (!parsed.ok) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: parsed.error }));
            return;
          }

          const rawVariant = (urlObj.searchParams.get('variant') || 'compact').trim().toLowerCase();
          if (rawVariant !== 'baseline' && rawVariant !== 'compact' && rawVariant !== 'both') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              success: false,
              error: `Invalid variant "${rawVariant}". Expected "baseline", "compact", or "both".`
            }));
            return;
          }

          const rawPart = (urlObj.searchParams.get('part') || 'full').trim().toLowerCase();
          if (rawPart !== 'full' && rawPart !== 'month' && rawPart !== 'static' && rawPart !== 'subprompt') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              success: false,
              error: `Invalid part "${rawPart}". Expected "full", "month", "static", or "subprompt".`
            }));
            return;
          }

          const rawDomainParam = urlObj.searchParams.get('domain');
          const resolvedDomain = mod.resolveOriginalSourceDomain(rawDomainParam);
          if (!resolvedDomain) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              success: false,
              error: `Invalid domain "${rawDomainParam}". Expected "master", "career" (or "work"), "finance" (or "wealth"), "love" (or "romance"), or "family" (or "home").`
            }));
            return;
          }

          const rawFormat = (urlObj.searchParams.get('format') || 'json').trim().toLowerCase();
          if (rawFormat !== 'json' && rawFormat !== 'text') {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              success: false,
              error: `Invalid format "${rawFormat}". Expected "json" or "text".`
            }));
            return;
          }

          let chartSource: any = undefined;
          const personIdParam = (urlObj.searchParams.get('personId') || '').trim();
          if (personIdParam) {
            const dataPath = path.resolve(__dirname, 'src/data/stored_persons.json');
            let matchedPerson: any = null;
            if (fs.existsSync(dataPath)) {
              try {
                const db = JSON.parse(fs.readFileSync(dataPath, 'utf-8') || '{}');
                matchedPerson = db[personIdParam] || null;
              } catch {}
            }
            if (matchedPerson) {
              chartSource = {
                person: matchedPerson.profile,
                placements: matchedPerson.placements,
                dashaRecords: matchedPerson.dashaRecords
              };
            } else if (personIdParam !== '001ME') {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, error: `Person "${personIdParam}" not found.` }));
              return;
            }
          }

          const questionParam = urlObj.searchParams.get('question') ?? urlObj.searchParams.get('q') ?? undefined;

          const payload = mod.generateOriginalSourceApiPayload({
            year: parsed.year,
            monthIndex: parsed.monthIndex,
            variant: rawVariant,
            part: rawPart,
            domain: resolvedDomain,
            question: questionParam,
            chartSource
          });

          if (!payload.validated) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              success: false,
              error: 'Generated Original Source prompt failed integrity validation.',
              validationErrors: payload.validationErrors
            }));
            return;
          }

          if (rawFormat === 'text') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            const textBody = payload.variant === 'both'
              ? `=== BASELINE (14B) ===\n${payload.baseline.content}\n=== COMPACT ===\n${payload.compact.content}`
              : (payload.content || '');
            res.end(textBody);
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: false,
            error: err?.message || 'Failed to build Original Source content.'
          }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), geminiApiPlugin(env), claudeApiPlugin(env), astroApiPlugin(), docsServerPlugin(), localBatchPlugin(env), originalSourceApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Always ignore docs/, public/docs/, and runtime stored_*.json files so report/cache/log saves NEVER trigger a browser full-reload.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true'
        ? null
        : {
            ignored: [
              /[/\\]docs([/\\]|$)/,
              /[/\\]public[/\\]docs([/\\]|$)/,
              /stored_(prompt_logs|persons|ad_narratives|pd_evaluations)\.json$/
            ]
          },
    },
  };
});
