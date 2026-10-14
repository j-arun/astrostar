import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const docsDir = path.resolve(rootDir, 'docs');
const publicDocsDir = path.resolve(rootDir, 'public/docs');

[docsDir, publicDocsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ENGINES = [
  {
    key: 'claude_iq',
    name: 'Claude IQ (Haiku 5.5)',
    categoryLabel: '1. IQ',
    badge: '⚡ IQ Engine',
    providerId: 'claude_haiku',
    model: 'claude-haiku-5-5'
  },
  {
    key: 'claude_sonnet',
    name: 'Claude Sonnet 5.5',
    categoryLabel: '2. Sonnet',
    badge: '🧠 Sonnet Engine',
    providerId: 'claude_sonnet',
    model: 'claude-sonnet-5-5'
  },
  {
    key: 'gemini_pro',
    name: 'Google Gemini Pro',
    categoryLabel: '3. Gemini Pro',
    badge: '♊ Gemini Pro',
    providerId: 'gemini_pro',
    model: 'gemini-3.1-pro-preview'
  },
  {
    key: 'fable_ollama',
    name: 'Fable / Ollama (Local 7B)',
    categoryLabel: '4. Fable / Ollama',
    badge: '🖥️ Fable / Ollama',
    providerId: 'local_qwen',
    model: 'qwen2.5:7b-instruct'
  }
];

function generateHtmlContent(year, month, engine) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tamil Om Vedic Horoscope — ${month} ${year} (${engine.name})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); padding: 36px; border: 1px solid #e2e8f0; }
    .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; margin-bottom: 8px; }
    h1 { margin: 0 0 6px 0; font-size: 24px; color: #0f172a; }
    .meta { color: #64748b; font-size: 13px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; border-left: 4px solid #f59e0b; padding-left: 10px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
    .footer { border-top: 1px solid #e2e8f0; margin-top: 36px; padding-top: 18px; font-size: 12px; color: #94a3b8; text-align: center; }
    .tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; }
    .actions { margin-top: 16px; display: flex; gap: 10px; }
    .btn { padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn-pdf { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .btn-doc { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="badge">Vedic Reasoning Dossier</span>
        <h1>Tamil Om Vedic Horoscope Engine</h1>
        <div class="meta">
          <strong>Period:</strong> ${month} ${year} &bull; 
          <strong>Engine:</strong> ${engine.name} (${engine.categoryLabel}) &bull;
          <strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      <div>
        <span class="tag">Status: Verified Synthesis</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Bottom-Line Astrological Synthesis</div>
      <div class="card" style="background: #fffbeb; border-color: #fde68a;">
        <p style="margin: 0; font-size: 14.5px; font-weight: 500; color: #78350f;">
          Comprehensive Gochara transit analysis for ${month} ${year} synthesized under classical Parashara and Jaimini principles by ${engine.name}. Double Transit sanction of Jupiter and Saturn activates professional elevation, fiscal liquidity, and long-term domestic milestone fruition.
        </p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Vimshottari Dasha Hierarchy</div>
      <div class="grid">
        <div class="card">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Mahadasha (MD)</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 4px 0;">Venus (Sukra)</div>
          <div style="font-size: 12px; color: #475569;">Lords Houses 6 &amp; 11 &bull; Occupies House 1 in Kendra Sthana. High fruition index.</div>
        </div>
        <div class="card">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Antardasha (AD)</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 4px 0;">Saturn (Shani) [R]</div>
          <div style="font-size: 12px; color: #475569;">Lords Houses 2 &amp; 3 &bull; Auspicious 4th House Kendra support in Pisces.</div>
        </div>
        <div class="card">
          <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Pratyantardasha (PD)</div>
          <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 4px 0;">Mercury (Budha) [R]</div>
          <div style="font-size: 12px; color: #475569;">Lords Houses 7 &amp; 10 &bull; Transiting House 11 in Libra. Trade &amp; negotiation sanction.</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Core Life Domains Synthesis (5 Areas)</div>
      
      <div class="card">
        <h4 style="margin: 0 0 6px 0; color: #0f172a;">1. Career, Job Search &amp; Professional Standing</h4>
        <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #334155;">
          The 10th lord Mercury transiting in the 11th house of gains combined with Saturn's aspect grants major breakthroughs for career elevation and professional autonomy. If currently employed, leadership recognition and milestone bonuses manifest. For active job seekers, offer letter conversion windows peak between Day 14 and Day 25.
        </p>
        <span class="tag">Verdict: Favorable Expansion (Score: 86%)</span>
      </div>

      <div class="card">
        <h4 style="margin: 0 0 6px 0; color: #0f172a;">2. Wealth, Cashflow &amp; Asset Protection</h4>
        <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #334155;">
          Liquid savings through the 2nd house remain stable, while 11th house Labha placements deliver milestone inflows. Capital redeployment into tangible real estate or conservative equities is strongly sanctioned. Avoid speculative over-leverage during Chandrashtama intervals.
        </p>
        <span class="tag">Verdict: Capital Inflow &amp; Surplus (Score: 84%)</span>
      </div>

      <div class="card">
        <h4 style="margin: 0 0 6px 0; color: #0f172a;">3. Love, Romance &amp; Relationship Harmony</h4>
        <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #334155;">
          Venus in Swakshetra/Mitra Tara stimulates affectionate dialogue and sacred union pathways. Mutual trust deepens for long-term domestic commitments and marriage viability.
        </p>
        <span class="tag">Verdict: Classical Sacred Union (Score: 82%)</span>
      </div>

      <div class="card">
        <h4 style="margin: 0 0 6px 0; color: #0f172a;">4. Health, Physical Stamina &amp; Vitality</h4>
        <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #334155;">
          General constitution is resilient with Jupiter aspecting Lagna. Minor digestive pacing and sleep rhythms require mindful monitoring when Moon crosses 8th house Gemini.
        </p>
        <span class="tag">Verdict: Stable Stamina (Score: 78%)</span>
      </div>

      <div class="card">
        <h4 style="margin: 0 0 6px 0; color: #0f172a;">5. Domestic Sanctuary &amp; Family Wellbeing</h4>
        <p style="margin: 0 0 8px 0; font-size: 13.5px; color: #334155;">
          4th house domestic harmony is reinforced by Saturn's supportive transit. Household upgrades, real estate legal clearances, and maternal vitality flourish smoothly.
        </p>
        <span class="tag">Verdict: Domestic Harmony (Score: 88%)</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Download Formats &amp; Archive Links</div>
      <div class="actions">
        <a href="Tamil_Vedic_Report_${month}_${year}_${engine.key}.pdf" class="btn btn-pdf" target="_blank" download>
          <span>📕 Download PDF Version</span>
        </a>
        <a href="Tamil_Vedic_Report_${month}_${year}_${engine.key}.doc" class="btn btn-doc" download>
          <span>📘 Download Word (.doc) Version</span>
        </a>
        <a href="Tamil_Vedic_Report_${month}_${year}_${engine.key}.html" class="btn" style="background:#e0e7ff; color:#3730a3;" target="_blank">
          <span>📄 Open Full HTML Dossier</span>
        </a>
      </div>
    </div>

    <div class="footer">
      Tamil Om Vedic Horoscope Engine &bull; Stored in Web Server /docs Repository &bull; ${month} ${year} &bull; Parashara &amp; Jaimini Transit Synthesis
    </div>
  </div>
</body>
</html>`;
}

function generateWordContent(year, month, engine) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Tamil Vedic Horoscope — ${month} ${year} — ${engine.name}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; margin: 1in; }
  h1 { font-size: 18pt; color: #0f172a; margin-bottom: 4pt; }
  h2 { font-size: 13pt; color: #92400e; border-bottom: 1pt solid #cbd5e1; padding-bottom: 2pt; margin-top: 14pt; }
  h3 { font-size: 12pt; color: #1e293b; margin-top: 10pt; }
  p { margin-top: 0; margin-bottom: 6pt; }
  .box { background: #f8fafc; border: 1pt solid #cbd5e1; padding: 10pt; margin-bottom: 10pt; }
  .footer { font-size: 9pt; color: #64748b; border-top: 1pt solid #e2e8f0; margin-top: 20pt; padding-top: 6pt; }
</style>
</head>
<body>
  <h1>Tamil Om Vedic Horoscope — ${month} ${year}</h1>
  <p><strong>Reasoning Engine:</strong> ${engine.name} (${engine.categoryLabel}) | <strong>Classification:</strong> Parashara &amp; Jaimini Synthesis</p>
  
  <h2>1. Executive Summary &amp; Bottom Line</h2>
  <div class="box">
    <p>Comprehensive Gochara transit analysis for ${month} ${year} synthesized under classical Parashara principles by ${engine.name}. Double transit sanction of Jupiter and Saturn activates professional expansion, fiscal liquidity, and long-term domestic milestone fruition.</p>
  </div>

  <h2>2. Vimshottari Dasha Hierarchy</h2>
  <p><strong>Mahadasha Lord:</strong> Venus (Sukra) — Functional Benefic placement in House 1. High fruition capacity.</p>
  <p><strong>Antardasha Lord:</strong> Saturn (Shani) [R] — Auspicious 4th House Kendra support in Pisces.</p>
  <p><strong>Pratyantardasha Lord:</strong> Mercury (Budha) [R] — Transiting House 11 in Libra. Sanction for milestone contract negotiations.</p>

  <h2>3. Core Life Domains Synthesis</h2>
  <h3>Career &amp; Professional Trajectory</h3>
  <p>10th lord Mercury transiting in the 11th house of gains combined with Saturn's aspect grants major breakthroughs for career elevation and professional autonomy.</p>

  <h3>Wealth, Capital &amp; Financial Gains</h3>
  <p>Liquid savings through the 2nd house remain stable, while 11th house Labha placements deliver milestone inflows.</p>

  <h3>Love, Romance &amp; Relationship Horizon</h3>
  <p>Venus in Swakshetra/Mitra Tara stimulates affectionate dialogue and sacred union pathways. Mutual trust deepens for long-term domestic commitments.</p>

  <h3>Health &amp; Physical Vitality</h3>
  <p>General constitution is resilient with Jupiter aspecting Lagna. Minor digestive pacing and sleep rhythms require mindful monitoring when Moon crosses 8th house Gemini.</p>

  <h3>Domestic Peace &amp; Family Harmony</h3>
  <p>4th house domestic harmony is reinforced by Saturn's supportive transit. Household upgrades, real estate legal clearances, and maternal vitality flourish smoothly.</p>

  <div class="footer">
    Tamil Om Vedic Horoscope Engine • Document Stored in Web Server /docs Folder • ${month} ${year}
  </div>
</body>
</html>`;
}

// Generate simple valid PDF bytes
function generateSimplePdf(year, month, engine) {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 440 >>
stream
BT
/F1 18 Tf
50 780 Td
(Tamil Om Vedic Horoscope - ${month} ${year}) Tj
/F1 12 Tf
0 -26 Td
(Reasoning Engine: ${engine.name} [${engine.categoryLabel}]) Tj
0 -20 Td
(Synthesis: Full-Month Parashara & Jaimini Transit Analysis) Tj
0 -30 Td
(Vimshottari Dasha: Venus MD | Saturn AD | Mercury PD) Tj
0 -24 Td
(Career & Job: Favorable Expansion - Offer Letter & Milestone Inflow Window) Tj
0 -20 Td
(Finance & Wealth: Strong 2nd & 11th House Gains Inflow) Tj
0 -20 Td
(Love & Marriage: Classical Sacred Union & Domestic Harmony) Tj
0 -20 Td
(Health & Vitality: Stable Stamina, Mindful Sleep Rhythm) Tj
0 -40 Td
(Tamil Om Vedic Engine - Stored in Web Server /docs Archive) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000736 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
816
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

const catalog = {
  years: [2020, 2022, 2023, 2024, 2025, 2026, 2027],
  catalog: {}
};

catalog.years.forEach(y => {
  catalog.catalog[y] = {
    year: y,
    months: {}
  };
});

const SEED_PERIODS = [
  { year: 2026, month: 'October', monthIndex: 9 },
  { year: 2020, month: 'December', monthIndex: 11 }
];

SEED_PERIODS.forEach(period => {
  const { year, month, monthIndex } = period;
  const reports = {};

  ENGINES.forEach(eng => {
    // Directories
    const relSubDir = path.join(String(year), month, eng.key);
    const targetDir1 = path.join(docsDir, relSubDir);
    const targetDir2 = path.join(publicDocsDir, relSubDir);

    [targetDir1, targetDir2].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    const fileBase = `Tamil_Vedic_Report_${month}_${year}_${eng.key}`;
    const htmlFile = `${fileBase}.html`;
    const docFile = `${fileBase}.doc`;
    const pdfFile = `${fileBase}.pdf`;
    const jsonFile = `report_data.json`;

    const htmlContent = generateHtmlContent(year, month, eng);
    const docContent = generateWordContent(year, month, eng);
    const pdfBuffer = generateSimplePdf(year, month, eng);

    const reportData = {
      year,
      month,
      engineKey: eng.key,
      engineName: eng.name,
      savedAt: new Date().toISOString(),
      summarySentence: `Comprehensive Gochara transit analysis for ${month} ${year} synthesized under classical Parashara and Jaimini principles by ${eng.name}.`,
      context: {
        selectedYear: year,
        selectedMonth: monthIndex,
        isComprehensiveMonthly: true,
        houseNumber: 1,
        rashiName: 'Dhanus (Sagittarius)',
        activeDasha: {
          mahadasha: 'Venus',
          antardasha: 'Saturn',
          pratyantardasha: 'Mercury'
        }
      },
      narrative: {
        providerUsed: eng.providerId,
        summarySentence: `Comprehensive Gochara transit analysis for ${month} ${year} synthesized under classical Parashara and Jaimini principles by ${eng.name}.`,
        part1_probabilityAndScope: `The planetary transit alignments for ${month} ${year} show prominent activation of personal and professional aspirations under ${eng.name} reasoning.`,
        part2_financialAndResources: `Financial reserves through the 2nd and 11th houses demonstrate stable inflow with auspicious investment windows.`,
        part3_microTimingWindow: `Peak trigger windows are highlighted across the lunar progression with favorable days for milestone execution.`,
        overallConfidence: 0.85
      }
    };

    [targetDir1, targetDir2].forEach(d => {
      fs.writeFileSync(path.join(d, htmlFile), htmlContent, 'utf-8');
      fs.writeFileSync(path.join(d, docFile), docContent, 'utf-8');
      fs.writeFileSync(path.join(d, pdfFile), pdfBuffer);
      fs.writeFileSync(path.join(d, jsonFile), JSON.stringify(reportData, null, 2), 'utf-8');
    });

    reports[eng.key] = {
      engineKey: eng.key,
      engineName: eng.name,
      categoryLabel: eng.categoryLabel,
      badge: eng.badge,
      providerId: eng.providerId,
      htmlUrl: `/docs/${year}/${month}/${eng.key}/${htmlFile}`,
      pdfUrl: `/docs/${year}/${month}/${eng.key}/${pdfFile}`,
      docUrl: `/docs/${year}/${month}/${eng.key}/${docFile}`,
      timestamp: new Date().toISOString(),
      hasNarrative: true,
      summarySentence: reportData.summarySentence
    };
  });

  catalog.catalog[year].months[month] = {
    monthName: month,
    monthIndex,
    reports
  };
});

// Save catalog JSON
fs.writeFileSync(path.join(docsDir, 'reports_catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
fs.writeFileSync(path.join(publicDocsDir, 'reports_catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');

console.log('✓ Successfully seeded web server docs repository for 2026 October and 2020 December with all 4 reasoning engines (HTML, PDF, DOC, JSON)!');
