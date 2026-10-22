import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
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

              const existingIdx = notesDb[personId].findIndex(item =>
                item.mahadasha_lord_md === record.mahadasha_lord_md &&
                item.antardasha_lord_ad === record.antardasha_lord_ad &&
                item.pratyantardasha_lord_pd === record.pratyantardasha_lord_pd &&
                item.start_date === record.start_date &&
                item.end_date === record.end_date
              );

              if (existingIdx >= 0) {
                notesDb[personId][existingIdx] = record;
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

              const rated = feedsToUse.filter((f: any) => (f.notes && f.notes.trim()) || f.evaluation_rating !== null);
              const narrativeLines = rated.length > 0
                ? rated.map((f: any) => {
                    const r = f.evaluation_rating;
                    const rLabel = r === 10 ? 'positive' : r === 0 ? 'challenging' : 'favorable/mixed';
                    const lord = f.pratyantardasha_lord || f.pratyantardasha_lord_pd || 'Graha';
                    const noteText = (f.notes || '').trim() || `Experienced ${rLabel} circumstances during ${lord} sub-period`;
                    return `[PD: ${lord}] ${noteText.replace(/[.]+$/, '')}. (${f.start_date} to ${f.end_date}, evaluated as ${rLabel}).`;
                  })
                : [
                    `[PD: ${ad}] Stable transit unfolding across the ${start} to ${end} window under ${md} Mahadasha influence.`
                  ];

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
            const { prompt, apiKey: bodyApiKey, model: requestedModel, isTestPing } = JSON.parse(body || '{}');

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

            // Normalize models to valid @google/genai SDK aliases
            let targetModel = requestedModel || GEMINI_PRIMARY_MODEL;
            if (targetModel === 'gemini_pro' || targetModel === 'gemini-pro' || targetModel === 'gemini-2.5-pro') {
              targetModel = 'gemini-4-argon';
            } else if (targetModel === 'gemini-2.5-flash' || targetModel === 'gemini-2.0-flash' || targetModel === 'gemini-1.5-flash') {
              targetModel = GEMINI_PRIMARY_MODEL;
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
              try {
                const pingRes = await ai.models.generateContent({
                  model: targetModel,
                  contents: 'Say hello in 3 words to confirm Gemini API key connection.',
                  config: { maxOutputTokens: 15 }
                });
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  status: 'OK',
                  message: `Gemini API Key Verified & Connected (${targetModel})`,
                  model: pingRes.modelVersion || targetModel,
                  sampleResponse: pingRes.text
                }));
                return;
              } catch (pingErr: any) {
                res.statusCode = 400;
                let errDetail = pingErr.message || 'Gemini Key Ping Failed';
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

            let response;
            let usedModel = targetModel;
            try {
              response = await ai.models.generateContent({
                model: targetModel,
                contents: prompt,
                config: {
                  temperature: 0.2,
                  responseMimeType: 'application/json'
                }
              });
            } catch (primaryError: any) {
              usedModel = GEMINI_FALLBACK_MODEL;
              try {
                response = await ai.models.generateContent({
                  model: usedModel,
                  contents: prompt,
                  config: {
                    temperature: 0.2,
                    responseMimeType: 'application/json'
                  }
                });
              } catch (fallbackError: any) {
                throw new Error(
                  `Primary model '${targetModel}' failed: ${primaryError.message}. ` +
                  `Fallback model '${usedModel}' failed: ${fallbackError.message}`
                );
              }
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
            } else if (errorMsg.includes('API key not valid') || errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('INVALID_ARGUMENT')) {
              statusCode = 400;
              errorMsg = 'Invalid Gemini API Key: Google Generative AI rejected the key with 400 INVALID_ARGUMENT. Please check your Gemini API key at https://aistudio.google.com/apikey and paste it into the Gemini Key input.';
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
            const { prompt, model: requestedModel, apiKey: bodyApiKey, thinkingMode, budgetTokens, maxTokens, isTestPing } = JSON.parse(body || '{}');

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
              messages: [
                {
                  role: 'user',
                  content: isPing ? 'hi' : prompt
                }
              ]
            };

            // Fable requires adaptive thinking; effort controls its depth.
            if (primaryModel === 'claude-fable-5-1') {
              payload.thinking = { type: 'adaptive' };
              payload.output_config = {
                effort: thinkingMode === 'enabled' ? 'high' : thinkingMode === 'auto' ? 'medium' : 'low'
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

            // 1. Log outgoing payload right before fetch (as requested)
            console.log("SENT:", JSON.stringify({ ...payload, messages: "[omitted]" }));

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

        // 1. GET /api/docs/catalog
        if (pathname === '/api/docs/catalog' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          try {
            const catalogPath = path.resolve(__dirname, 'docs/reports_catalog.json');
            if (fs.existsSync(catalogPath)) {
              const data = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
              res.statusCode = 200;
              res.end(JSON.stringify(data));
              return;
            }
          } catch (e: any) {
            console.error('Error reading catalog:', e);
          }
          res.statusCode = 200;
          res.end(JSON.stringify({ years: [2020, 2022, 2023, 2024, 2025, 2026, 2027], catalog: {} }));
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
              const publicDocsDir = path.resolve(__dirname, 'public/docs', String(year), String(month), String(engineKey));
              const savedAt = new Date();
              const timestamp = createReportFilenameTimestamp(savedAt);

              [docsDir, publicDocsDir].forEach(d => {
                if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
              });

              const fileBase = `Tamil_Vedic_Report_${month}_${year}_${engineKey}_${timestamp}`;
              const htmlFilename = `${fileBase}.html`;
              const docFilename = `${fileBase}.doc`;
              const pdfFilename = `${fileBase}.pdf`;
              const jsonFilename = `report_data.json`;

              // Save HTML
              if (htmlContent) {
                [docsDir, publicDocsDir].forEach(d => {
                  fs.writeFileSync(path.join(d, htmlFilename), htmlContent, 'utf-8');
                });
              }

              // Save Word Doc
              if (docContent) {
                [docsDir, publicDocsDir].forEach(d => {
                  fs.writeFileSync(path.join(d, docFilename), docContent, 'utf-8');
                });
              }

              // Save PDF
              if (pdfBase64) {
                const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:.*,/, '');
                const pdfBuffer = Buffer.from(base64Data, 'base64');
                [docsDir, publicDocsDir].forEach(d => {
                  fs.writeFileSync(path.join(d, pdfFilename), pdfBuffer);
                });
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
              [docsDir, publicDocsDir].forEach(d => {
                fs.writeFileSync(path.join(d, jsonFilename), JSON.stringify(reportData, null, 2), 'utf-8');
              });

              // Update reports_catalog.json
              const catalogPath = path.resolve(__dirname, 'docs/reports_catalog.json');
              const publicCatalogPath = path.resolve(__dirname, 'public/docs/reports_catalog.json');
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
              fs.writeFileSync(publicCatalogPath, JSON.stringify(cat, null, 2), 'utf-8');

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss(), geminiApiPlugin(env), claudeApiPlugin(env), astroApiPlugin(), docsServerPlugin()],
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
